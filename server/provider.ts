import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import type { Job, Project, Asset } from '../shared/types';
import { blockers, dependencies, imagePrompt, resolvedReferences } from '../shared/engine';
import { store, mediaDir } from './store';
import { automationView, referenceSignature } from '../shared/automation';

export const providerInfo = () => ({
  configured: !!(process.env.STADIUM_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
  model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
  provider: 'OpenAI Images',
  size: '1024x1536',
  exportSize: '1080x1920',
  videoRendering: !!(process.env.STADIUM_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
});
export function fingerprint(p: Project) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        facts: p.facts,
        camera: p.camera,
        capacity: p.capacity,
        selected: p.selectedId,
        notes: p.notes,
        date: p.referenceDate,
        playerConsent: p.playerConsent,
        variant: p.variant,
      }),
    )
    .digest('hex');
}
export async function saveImage(
  buffer: Buffer,
  code: string,
  origin: Asset['origin'],
  references: string[],
  extra: Partial<Asset> = {},
): Promise<Asset> {
  const id = randomUUID(),
    filename = `${id}.png`;
  const output = await sharp(buffer, { limitInputPixels: 50_000_000 })
    .rotate()
    .png()
    .toBuffer({ resolveWithObject: true });
  await fs.writeFile(path.join(mediaDir, filename), output.data, { mode: 0o600 });
  return {
    id,
    code,
    filename,
    url: `/media/${filename}`,
    status: 'review',
    origin,
    createdAt: new Date().toISOString(),
    references,
    checks: [],
    width: output.info.width,
    height: output.info.height,
    ...extra,
  };
}
export function invalidateDescendants(p: Project, code: string) {
  const changed = new Set([code]);
  let progress = true;
  while (progress) {
    progress = false;
    for (const a of p.assets) {
      if (
        a.status === 'accepted' &&
        !changed.has(a.code) &&
        (dependencies(p, a.code).some((d) => changed.has(d)) ||
          a.references.some((id) => p.assets.some((ref) => ref.id === id && changed.has(ref.code))))
      ) {
        changed.add(a.code);
        progress = true;
      }
    }
  }
  for (const a of p.assets)
    if (changed.has(a.code) && a.code !== code && a.status === 'accepted') a.status = 'rejected';
}
type Task = { job: Job; snapshot: Project; hash: string; referenceIds: string[] };
const queue: Task[] = [];
let processing = false;
const controllers = new Map<string, AbortController>();
export function cancelJob(id: string) {
  const j = store.jobs().find((j) => j.id === id);
  if (!j) return;
  if (j.status === 'queued' || j.status === 'running') {
    controllers.get(id)?.abort();
    store.job({
      ...j,
      status: 'cancelled',
      error: 'İptal edildi. Sağlayıcıya ulaşmış istek ücretlendirilmiş olabilir.',
    });
  }
}
export function enqueue(
  p: Project,
  code: string,
  options: { allowDraftReferences?: boolean; runId?: string } = {},
) {
  if (options.allowDraftReferences) p = automationView(p);
  const existing = store
    .jobs()
    .find(
      (j) => j.projectId === p.id && j.code === code && ['queued', 'running'].includes(j.status),
    );
  if (existing) return existing;
  const job: Job = {
    id: randomUUID(),
    projectId: p.id,
    code,
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    costNotice: 'Bir görsel isteği sağlayıcı tarafından ücretlendirilebilir.',
    kind: 'image',
    ...options,
  };
  store.job(job);
  queue.push({
    job,
    snapshot: structuredClone(p),
    hash: fingerprint(p),
    referenceIds: resolvedReferences(p, code).map((a) => a.id),
  });
  void drain();
  return job;
}
async function drain() {
  if (processing) return;
  processing = true;
  try {
    while (queue.length) {
      const task = queue.shift()!;
      const job = store.jobs().find((j) => j.id === task.job.id)!;
      if (job.status === 'cancelled') continue;
      const controller = new AbortController();
      controllers.set(job.id, controller);
      const timeout = setTimeout(() => controller.abort(), 240_000);
      try {
        let p = store.project(job.projectId);
        if (p && job.allowDraftReferences) p = automationView(p);
        if (!p || fingerprint(p) !== task.hash)
          throw new Error('Proje ayarları değişti. Güncel ayarlarla yeniden kuyruğa ekleyin.');
        if (blockers(p, job.code).length)
          throw new Error('Referans veya doğrulama koşulları artık sağlanmıyor.');
        if (
          JSON.stringify(resolvedReferences(p, job.code).map((a) => a.id)) !==
          JSON.stringify(task.referenceIds)
        )
          throw new Error('Referans sürümü değişti. Yeniden kuyruğa ekleyin.');
        job.status = 'running';
        store.job(job);
        const prompt = imagePrompt(task.snapshot, job.code);
        const info = providerInfo();
        const form = new FormData();
        form.set('model', info.model);
        form.set('prompt', prompt);
        form.set('n', '1');
        form.set('size', info.size);
        const refs = resolvedReferences(task.snapshot, job.code);
        for (const a of refs) {
          const bytes = await fs.readFile(path.join(mediaDir, a.filename));
          form.append('image[]', new Blob([bytes], { type: 'image/png' }), a.filename);
        }
        const response = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.STADIUM_OPENAI_API_KEY || process.env.OPENAI_API_KEY}`,
          },
          body: form,
          signal: controller.signal,
        });
        if (!response.ok) {
          const messages: Record<number, string> = {
            401: 'Görsel servisi anahtarı geçersiz veya yetkisiz.',
            403: 'Model erişimi veya ağ izni reddedildi.',
            429: 'Sağlayıcı kota / hız sınırı. Otomatik tekrar yapılmadı.',
          };
          throw new Error(
            messages[response.status] ||
              `Görsel servisi HTTP ${response.status}. Modelin çoklu görsel düzenleme ve 1024x1536 boyutunu desteklediğini kontrol edin.`,
          );
        }
        const result = (await response.json()) as { data?: { b64_json?: string }[] };
        const encoded = result.data?.[0]?.b64_json;
        if (!encoded || encoded.length > 65_000_000)
          throw new Error('Sağlayıcı geçerli boyutta bir görsel döndürmedi.');
        p = store.project(job.projectId);
        if (!p) throw new Error('Proje silindi.');
        const currentView = job.allowDraftReferences ? automationView(p) : p;
        if (
          fingerprint(p) !== task.hash ||
          JSON.stringify(resolvedReferences(currentView, job.code).map((a) => a.id)) !==
            JSON.stringify(task.referenceIds)
        )
          throw new Error(
            'Üretim sırasında proje veya referans değişti. Sonuç yeni akışa eklenmedi; sağlayıcı ücretlendirmiş olabilir.',
          );
        if (store.jobs().find((j) => j.id === job.id)?.status === 'cancelled') continue;
        const asset = await saveImage(
          Buffer.from(encoded, 'base64'),
          job.code,
          'openai',
          refs.map((a) => a.id),
          { prompt, model: info.model, configuration: referenceSignature(p, job.code) },
        );
        p.assets.push(asset);
        store.save(p);
        store.job({ ...job, status: 'done', assetId: asset.id });
      } catch (e) {
        if (store.jobs().find((j) => j.id === job.id)?.status !== 'cancelled')
          store.job({
            ...job,
            status: 'failed',
            error:
              e instanceof Error
                ? e.name === 'AbortError'
                  ? 'İstek zaman aşımına uğradı. Ücret kaydını kontrol edin; otomatik tekrar yapılmadı.'
                  : e.message
                : 'Üretim tamamlanamadı.',
          });
      } finally {
        clearTimeout(timeout);
        controllers.delete(job.id);
      }
    }
  } finally {
    processing = false;
  }
}
