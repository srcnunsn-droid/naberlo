import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Job, Project, VideoAsset } from '../shared/types';
import { accepted, clipPairs, imagePrompt, videoPrompts } from '../shared/engine';
import { automationView, projectSignature } from '../shared/automation';
import { mediaDir, store } from './store';
import { shotDuration } from '../shared/story';

export const videoInfo = () => ({
  configured: !!(process.env.STADIUM_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
  provider: 'OpenAI Video',
  model: process.env.OPENAI_VIDEO_MODEL || 'sora-2',
  seconds: 12,
  supportedSeconds: [4, 8, 12],
  size: '720x1280',
  supportsEndFrame: false,
  note: 'Sora tek başlangıç görseli alır. Final kare eşleşmesi ve mimari devamlılık kontrol bekler.',
});
const key = () => process.env.STADIUM_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const headers = () => ({ Authorization: `Bearer ${key()}` });
function errorMessage(status: number) {
  return status === 401
    ? 'OpenAI API anahtarı geçersiz.'
    : status === 403
      ? 'Video modeli erişimi reddedildi. OpenAI hesabındaki model yetkisini kontrol edin.'
      : status === 429
        ? 'Video sağlayıcısı kota veya hız sınırı bildirdi.'
        : `Video sağlayıcısı HTTP ${status}.`;
}
function view(p: Project, allowDraft: boolean) {
  return allowDraft ? automationView(p) : p;
}
function references(p: Project, code: string) {
  const pair = clipPairs.find((c) => c[0] === code);
  if (!pair) throw new Error('Video aşaması bulunamadı.');
  const start = accepted(p, pair[2]),
    end = accepted(p, pair[3]);
  if (!start || !end) throw new Error(`${pair[2]} ve ${pair[3]} video referansları eksik.`);
  return [start, end];
}
export function soraPrompt(p: Project, code: string) {
  const seconds = shotDuration(p, code);
  const clip = videoPrompts(p).find((c) => c.id === code);
  if (!clip?.ready) throw new Error('Video referansları eksik.');
  const content = clip.prompt
    .split('\n')
    .filter(
      (line) =>
        !line.startsWith('INPUTS:') && !line.startsWith('TARGET:') && !line.startsWith('TIMELINE:'),
    )
    .join('\n')
    .replace('10-second', `${seconds}-second`);
  const target = imagePrompt(p, clip.end).split('VISIBLE STATE\n')[1]?.split('\n\nCAMERA')[0] || '';
  return `The uploaded input_reference is the actual opening frame. Preserve its stadium, perspective and city anchors. Only one image is supplied; no image-2 or end-frame control is available.\n${content}\nTIMELINE: 0–0.5 s immediate visible trigger; 0.5–${(seconds * 0.72).toFixed(1)} s causal progression; ${(seconds * 0.72).toFixed(1)}–${seconds - 0.5} s complete the required final state; final 0.5 s readable hold.\nTARGET STATE DESCRIPTION: ${target}`;
}
export function enqueueVideo(
  p: Project,
  code: string,
  allowDraftReferences = false,
  runId?: string,
) {
  if (!key()) throw new Error('OpenAI API anahtarı bağlı değil.');
  const existing = store
    .jobs()
    .find(
      (j) =>
        j.projectId === p.id &&
        j.code === code &&
        j.kind === 'video' &&
        ['queued', 'running'].includes(j.status),
    );
  if (existing) return existing;
  const v = view(p, allowDraftReferences),
    refs = references(v, code),
    info = videoInfo();
  if (!['sora-2', 'sora-2-pro'].includes(info.model))
    throw new Error('OPENAI_VIDEO_MODEL sora-2 veya sora-2-pro olmalı.');
  const now = new Date().toISOString();
  const job: Job = {
    id: randomUUID(),
    projectId: p.id,
    code,
    kind: 'video',
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    model: info.model,
    seconds: shotDuration(p, code),
    prompt: soraPrompt(v, code),
    referenceIds: refs.map((a) => a.id),
    configuration: projectSignature(p),
    allowDraftReferences,
    runId,
    costNotice: `${shotDuration(p, code)} saniyelik video isteği OpenAI API hesabında ücret oluşturur.`,
  };
  store.job(job);
  return job;
}
async function limitedVideo(response: Response) {
  const limit = 200 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > limit)
    throw new Error('Video dosyası 200 MB sınırını aşıyor.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Video dosyası boş.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error('Video dosyası 200 MB sınırını aşıyor.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.length < 12 || bytes.toString('ascii', 4, 8) !== 'ftyp')
    throw new Error('Sağlayıcı geçerli MP4 döndürmedi.');
  return bytes;
}
let working = false;
export async function tickVideos() {
  if (working) return;
  working = true;
  try {
    const job = store
      .jobs()
      .filter((j) => j.kind === 'video' && ['queued', 'running'].includes(j.status))
      .reverse()[0];
    if (!job) return;
    try {
      const p = store.project(job.projectId);
      if (!p) throw new Error('Proje silindi.');
      const refs = references(view(p, !!job.allowDraftReferences), job.code);
      if (
        projectSignature(p) !== job.configuration ||
        JSON.stringify(refs.map((a) => a.id)) !== JSON.stringify(job.referenceIds)
      )
        throw new Error('Proje veya video referansı değişti. Eski işlem tekrar gönderilmedi.');
      if (!job.remoteId) {
        // Persist before POST. A crash without a returned remote ID must never
        // cause a second possibly billed creation request on restart.
        store.job({ ...job, status: 'running' });
        const source = await fs.readFile(path.join(mediaDir, refs[0].filename));
        const image = await sharp(source)
          .resize(720, 1280, { fit: 'contain', background: '#10120f' })
          .png()
          .toBuffer();
        const form = new FormData();
        form.set('model', job.model!);
        form.set('seconds', String(job.seconds));
        form.set('size', '720x1280');
        form.set('prompt', job.prompt!);
        form.set('input_reference', new Blob([image], { type: 'image/png' }), 'opening.png');
        const response = await fetch('https://api.openai.com/v1/videos', {
          method: 'POST',
          headers: headers(),
          body: form,
          signal: AbortSignal.timeout(120000),
        });
        if (!response.ok) throw new Error(errorMessage(response.status));
        const result = (await response.json()) as { id?: string };
        if (!result.id || !/^[\w-]{1,160}$/.test(result.id))
          throw new Error(
            'Sağlayıcı video işlem kimliği döndürmedi; yeniden göndermeden önce hesabı kontrol edin.',
          );
        const current = store.jobs().find((j) => j.id === job.id)!;
        store.job({
          ...current,
          remoteId: result.id,
          status: current.status === 'cancelled' ? 'cancelled' : 'running',
          progress: 0,
        });
        return;
      }
      const response = await fetch(`https://api.openai.com/v1/videos/${job.remoteId}`, {
        headers: headers(),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(errorMessage(response.status));
      const result = (await response.json()) as {
        status: string;
        progress?: number;
        error?: { code?: string };
      };
      if (store.jobs().find((j) => j.id === job.id)?.status === 'cancelled') return;
      if (result.status === 'failed')
        throw new Error(
          `Video üretilemedi (${String(result.error?.code || 'provider_error').slice(0, 80)}). Otomatik tekrar yapılmadı.`,
        );
      if (result.status !== 'completed') {
        if (!['queued', 'in_progress'].includes(result.status))
          throw new Error('Bilinmeyen video sağlayıcı durumu.');
        store.job({
          ...job,
          status: 'running',
          progress: Math.max(0, Math.min(99, Number(result.progress) || 0)),
        });
        return;
      }
      const media = await fetch(`https://api.openai.com/v1/videos/${job.remoteId}/content`, {
        headers: headers(),
        signal: AbortSignal.timeout(120000),
      });
      if (!media.ok) throw new Error(errorMessage(media.status));
      const bytes = await limitedVideo(media);
      const current = store.project(p.id);
      if (
        !current ||
        projectSignature(current) !== job.configuration ||
        JSON.stringify(
          references(view(current, !!job.allowDraftReferences), job.code).map((a) => a.id),
        ) !== JSON.stringify(job.referenceIds)
      )
        throw new Error('Üretim sırasında proje veya referans değişti. Sonuç projeye eklenmedi.');
      if (store.jobs().find((j) => j.id === job.id)?.status === 'cancelled') return;
      const id = randomUUID(),
        filename = `${id}.mp4`;
      await fs.writeFile(path.join(mediaDir, filename), bytes, { mode: 0o600 });
      const asset: VideoAsset = {
        id,
        code: job.code,
        filename,
        url: `/media/${filename}`,
        providerId: job.remoteId,
        model: job.model!,
        seconds: job.seconds!,
        status: 'review',
        references: job.referenceIds!,
        configuration: job.configuration!,
        createdAt: new Date().toISOString(),
      };
      current.videos ||= [];
      current.videos.push(asset);
      store.save(current);
      store.job({ ...job, status: 'done', progress: 100, assetId: id });
    } catch (error) {
      const current = store.jobs().find((j) => j.id === job.id)!;
      if (current.status !== 'cancelled')
        store.job({
          ...current,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Video tamamlanamadı.',
        });
    }
  } finally {
    working = false;
  }
}
export function resumeVideo(id: string) {
  const job = store.jobs().find((j) => j.id === id);
  if (!job || job.kind !== 'video' || !job.remoteId || job.status !== 'failed')
    throw new Error('Yalnızca sağlayıcı kimliği olan başarısız video takibi sürdürülebilir.');
  return store.job({ ...job, status: 'running', error: undefined });
}
export function startVideoWorker() {
  void tickVideos();
  return setInterval(() => void tickVideos(), 5000).unref();
}
