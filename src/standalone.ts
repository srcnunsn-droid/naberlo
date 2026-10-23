import { z } from 'zod';
import seeds from '../data/clubs.json';
import meta from '../data/catalog-meta.json';
import master from '../docs/STADIUM-MASTER-v43.txt?raw';
import type { Asset, Club, Fact, FactKey, Project } from '../shared/types';
import { cameras, reviewChecks, stages, variantCounts } from '../shared/catalog';
import {
  accepted,
  blockers,
  createCandidates,
  dependencies,
  imagePrompt,
  isSheet,
  parseSheet,
  resolvedReferences,
  selectionBlockers,
  sheetCode,
  videoPrompts,
} from '../shared/engine';
import { ApiError } from './api';

function fail(message: string, status = 400, issues: string[] = []): never {
  throw new ApiError(message, status, issues);
}
const factKeys = [
  'club',
  'stadium',
  'city',
  'colors',
  'symbol',
  'capacity',
  'geography',
  'crest',
  'player',
] as const;
const sourceUrl = z
  .string()
  .url()
  .refine((s) => /^https?:\/\//.test(s));
const factSchema = z
  .object({
    value: z.string().max(3000),
    sources: z.array(sourceUrl).max(20),
    status: z.enum(['unverified', 'single-source', 'verified']),
    official: z.boolean(),
    checkedAt: z.string().optional(),
  })
  .superRefine((f, ctx) => {
    if (
      f.status === 'verified' &&
      (!f.value.trim() ||
        !f.sources.length ||
        (!f.official && new Set(f.sources.map((s) => new URL(s).hostname)).size < 2))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Doğrulama için değer ve resmi kaynak veya iki bağımsız kaynak gerekir.',
      });
  });
const factsSchema = z.object(
  Object.fromEntries(factKeys.map((k) => [k, factSchema])) as Record<FactKey, typeof factSchema>,
);
const clubSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(2).max(150),
  country: z.string().min(1).max(100),
  region: z.string().max(80).default('custom'),
  city: z.string().max(200).default(''),
  stadium: z.string().max(200).default(''),
  aliases: z.array(z.string().max(200)).max(100).default([]),
  source: sourceUrl,
  sourceRevision: z.string().max(100).default('user-import'),
});
const variantSchema = z.object({
  removal: z
    .number()
    .int()
    .min(0)
    .max(variantCounts.removal - 1),
  emergence: z
    .number()
    .int()
    .min(0)
    .max(variantCounts.emergence - 1),
  celebration: z
    .number()
    .int()
    .min(0)
    .max(variantCounts.celebration - 1),
});
const patchSchema = z
  .object({
    revision: z.number().int(),
    name: z.string().min(1).max(150).optional(),
    facts: factsSchema.optional(),
    referenceDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    camera: z.enum(cameras.map((c) => c.id) as [string, ...string[]]).optional(),
    capacity: z.number().int().min(100000).max(250000).optional(),
    variant: variantSchema.optional(),
    playerConsent: z.boolean().optional(),
    notes: z.string().max(4000).optional(),
  })
  .strict();

let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ||= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('naberlo-standalone-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('projects', { keyPath: 'id' });
      request.result.createObjectStore('clubs', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          'Tarayıcı kayıt alanı açılamadı. HTML dosyasını Chrome veya Edge ile açın; özel pencere kullanmayın.',
        ),
      );
  }));
}
async function read<T>(name: string, key?: string): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const store = database.transaction(name).objectStore(name);
    const request = key === undefined ? store.getAll() : store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function write(name: string, items: unknown[], remove?: string) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(name, 'readwrite');
    const store = transaction.objectStore(name);
    if (remove) store.delete(remove);
    for (const item of items) store.put(item);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(
        new Error(
          'Kayıt yapılamadı. Tarayıcı depolama alanı dolu veya engellenmiş olabilir; yedeğinizi indirin.',
        ),
      );
    transaction.onerror = () => {};
  });
}
async function allClubs() {
  return [...new Map([...seeds, ...(await read<Club[]>('clubs'))].map((c) => [c.id, c])).values()];
}
const normalize = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ı/g, 'i');
async function save(p: Project) {
  p.revision++;
  p.updatedAt = new Date().toISOString();
  await write('projects', [p]);
  return p;
}
async function project(id: string) {
  return (await read<Project | undefined>('projects', id)) || fail('Proje bulunamadı.', 404);
}
function validCode(p: Project, code: string) {
  if (
    ['SITE', 'CREST', 'PLAYER', ...stages.filter((s) => s.id !== 'C').map((s) => s.id)].includes(
      code,
    )
  )
    return true;
  const sheet = parseSheet(code);
  return (
    !!sheet &&
    isSheet(code) &&
    p.candidates.some((c) => c.batch === sheet.batch && c.sheet === sheet.sheet)
  );
}
function invalidate(p: Project, code: string) {
  const changed = new Set([code]);
  let progress = true;
  while (progress) {
    progress = false;
    for (const a of p.assets)
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
  for (const a of p.assets)
    if (changed.has(a.code) && a.code !== code && a.status === 'accepted') a.status = 'rejected';
}
async function upload(p: Project, form: FormData) {
  const file = form.get('image');
  const code = String(form.get('code'));
  if (!validCode(p, code)) fail('Geçersiz görsel kodu.');
  if (!(file instanceof File) || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    fail('PNG, JPEG veya WebP görseli seçin.');
  if (file.size > 15 * 1024 * 1024) fail('Görsel en fazla 15 MB olabilir.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return fail('Dosya geçerli bir görsel değil.');
  }
  try {
    if (bitmap.width * bitmap.height > 50_000_000) fail('Görsel en fazla 50 megapiksel olabilir.');
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    const id = crypto.randomUUID();
    const asset: Asset = {
      id,
      code,
      filename: `${id}.png`,
      url: canvas.toDataURL('image/png'),
      origin: 'upload',
      status: 'review',
      createdAt: new Date().toISOString(),
      width: bitmap.width,
      height: bitmap.height,
      references: dependencies(p, code)
        .map((c) => accepted(p, c)?.id)
        .filter((id): id is string => !!id),
      checks: [],
    };
    const current = await project(p.id);
    current.assets.push(asset);
    return save(current);
  } finally {
    bitmap.close();
  }
}

export async function request<T>(rawUrl: string, options: RequestInit = {}): Promise<T> {
  try {
    return (await route(rawUrl, options)) as T;
  } catch (error) {
    if (error instanceof z.ZodError)
      throw new ApiError(error.issues.map((i) => i.message).join('; '), 400);
    throw error;
  }
}
async function route(rawUrl: string, options: RequestInit): Promise<unknown> {
  const url = new URL(rawUrl, 'https://offline.invalid');
  const path = url.pathname;
  const method = options.method || 'GET';
  const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (path === '/api/status') {
    const clubs = await allClubs();
    return {
      provider: {
        configured: false,
        provider: 'Tek HTML · Harici görsel yükleme',
        model: 'Prompt ve yükleme modu',
        size: 'Yüklediğiniz görsel',
        exportSize: '1080x1920',
      },
      catalog: {
        ...meta,
        total: clubs.length,
        countries: new Set(clubs.map((c) => c.country)).size,
      },
      variantCounts,
    };
  }
  if (path === '/api/jobs') return [];
  if (path.startsWith('/api/clubs/live') || path.startsWith('/api/clubs/research/'))
    fail(
      'Tek HTML sürümü yerel katalogla çalışır. Yeni kulüpleri JSON dosyasıyla ekleyebilirsiniz.',
    );
  if (path === '/api/clubs/import' && method === 'POST') {
    const clubs = z.array(clubSchema).min(1).max(5000).parse(body);
    await write('clubs', clubs);
    return { imported: clubs.length };
  }
  if (path === '/api/clubs') {
    const clubs = await allClubs();
    const q = normalize(url.searchParams.get('q') || '');
    const list = clubs.filter(
      (c) =>
        (!q || normalize([c.name, c.city, c.country, ...c.aliases].join(' ')).includes(q)) &&
        (!url.searchParams.get('country') || c.country === url.searchParams.get('country')) &&
        (!url.searchParams.get('region') || c.region === url.searchParams.get('region')),
    );
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    return {
      items: list.slice(offset, offset + 60),
      total: list.length,
      countries: [...new Set(clubs.map((c) => c.country))].sort(),
    };
  }
  if (path === '/api/projects' && method === 'GET')
    return (await read<Project[]>('projects'))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(({ candidates, assets, ...p }) => ({
        ...p,
        candidateCount: candidates.length,
        assetCount: assets.length,
        acceptedCount: assets.filter((a) => a.status === 'accepted').length,
        cover: accepted({ assets } as Project, 'D0')?.url,
      }));
  if (path === '/api/projects' && method === 'POST') {
    const input = z
      .object({ clubId: z.string(), name: z.string().max(150).optional() })
      .parse(body);
    const club =
      (await allClubs()).find((c) => c.id === input.clubId) || fail('Kulüp bulunamadı.', 404);
    const facts = Object.fromEntries(
      factKeys.map((k): [FactKey, Fact] => [
        k,
        { value: '', sources: [], status: 'unverified', official: false },
      ]),
    ) as Record<FactKey, Fact>;
    for (const [key, value] of Object.entries({
      club: club.name,
      stadium: club.stadium,
      city: club.city,
    }))
      if (value)
        facts[key as FactKey] = {
          value,
          sources: [club.source],
          status: 'single-source',
          official: false,
        };
    const seed = Math.floor(Math.random() * 1_000_000),
      now = new Date().toISOString();
    return save({
      id: crypto.randomUUID(),
      name: input.name || `${club.aliases[0] || club.name} · Yeni vizyon`,
      club,
      createdAt: now,
      updatedAt: now,
      revision: 0,
      referenceDate: now.slice(0, 10),
      facts,
      camera: 'A',
      capacity: 100000,
      seed,
      batch: 1,
      candidates: createCandidates(seed),
      selectedId: null,
      assets: [],
      variant: { removal: 0, emergence: 0, celebration: 0 },
      playerConsent: false,
      notes: '',
    });
  }
  const match = path.match(/^\/api\/projects\/([^/]+)(?:\/(.*))?$/);
  if (!match) fail('Bu işlem tek HTML sürümünde bulunmuyor.', 404);
  const p = await project(match[1]),
    action = match[2] || '';
  if (!action && method === 'GET') return p;
  if (!action && method === 'DELETE') {
    await write('projects', [], p.id);
    return { deleted: true };
  }
  if (!action && method === 'PATCH') {
    const input = patchSchema.parse(body);
    if (input.revision !== p.revision) fail('Proje başka bir işlemle güncellendi. Yenileyin.', 409);
    if (
      ['facts', 'referenceDate', 'camera', 'capacity', 'notes'].some(
        (k) =>
          k in input &&
          JSON.stringify((input as Record<string, unknown>)[k]) !==
            JSON.stringify((p as unknown as Record<string, unknown>)[k]),
      )
    )
      for (const a of p.assets)
        if (!['SITE', 'CREST', 'PLAYER'].includes(a.code) && a.status === 'accepted')
          a.status = 'review';
    if (input.playerConsent === false)
      for (const a of p.assets)
        if (a.code === 'TF3' && a.status === 'accepted') a.status = 'review';
    if (input.variant && input.variant.celebration !== p.variant.celebration) {
      invalidate(p, 'SH0');
      for (const a of p.assets)
        if (a.code === 'SH0' && a.status === 'accepted') a.status = 'review';
    }
    Object.assign(p, input);
    return save(p);
  }
  if (action === 'batches' && method === 'POST') {
    if (p.batch >= 1000) fail('Bu projede 1.000 seri var; yeni proje açın.');
    p.batch++;
    p.candidates.push(...createCandidates(p.seed, p.batch));
    return save(p);
  }
  if (action === 'select' && method === 'POST') {
    const candidate =
      p.candidates.find((c) => c.id === body.candidateId) || fail('Tasarım bulunamadı.', 404);
    const issues = selectionBlockers(p, candidate);
    if (issues.length) fail('Önce serinin 10 kolajını kabul edin.', 409, issues);
    if (p.selectedId !== candidate.id) {
      invalidate(p, 'D0');
      for (const a of p.assets) if (a.code === 'D0' && a.status === 'accepted') a.status = 'review';
    }
    p.selectedId = candidate.id;
    return save(p);
  }
  if (action === 'assets' && method === 'POST' && options.body instanceof FormData)
    return upload(p, options.body);
  const review = action.match(/^assets\/([^/]+)\/review$/);
  if (review && method === 'POST') {
    const asset = p.assets.find((a) => a.id === review[1]) || fail('Görsel bulunamadı.', 404);
    const input = z
      .object({
        status: z.enum(['accepted', 'rejected']),
        checks: z.array(z.enum(reviewChecks as [string, ...string[]])).max(6),
      })
      .parse(body);
    if (input.status === 'accepted') {
      if (new Set(input.checks).size !== reviewChecks.length)
        fail('Altı kalite maddesini de kontrol edin.');
      if (!['SITE', 'CREST', 'PLAYER'].includes(asset.code)) {
        const issues = blockers(p, asset.code);
        if (issues.length) fail('Ön koşullar tamamlanmadı.', 409, issues);
      }
      invalidate(p, asset.code);
      for (const a of p.assets)
        if (a.code === asset.code && a.id !== asset.id && a.status === 'accepted')
          a.status = 'rejected';
      asset.references = resolvedReferences(p, asset.code).map((a) => a.id);
    } else if (asset.status === 'accepted') invalidate(p, asset.code);
    asset.status = input.status;
    asset.checks = input.checks;
    return save(p);
  }
  if (action.startsWith('prompts/')) {
    const code = action.slice(8);
    if (!validCode(p, code)) fail('Geçersiz aşama.');
    return { prompt: imagePrompt(p, code), blockers: blockers(p, code) };
  }
  if (action === 'videos') return videoPrompts(p);
  if (action.startsWith('generate'))
    fail(
      'Tek HTML sürümünde otomatik AI üretimi yok. Promptu kopyalayıp seçtiğiniz görsel aracında çalıştırın ve sonucu yükleyin.',
      503,
    );
  return fail('İşlem bulunamadı.', 404);
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function backup() {
  saveBlob(
    new Blob(
      [
        JSON.stringify({
          format: 'naberlo-html-v1',
          projects: await read<Project[]>('projects'),
          clubs: await read<Club[]>('clubs'),
        }),
      ],
      { type: 'application/json' },
    ),
    `naberlo-yedek-${new Date().toISOString().slice(0, 10)}.json`,
  );
}
const assetSchema = z.object({
  id: z.string().uuid(),
  code: z.string().max(30),
  filename: z.string().regex(/^[\w-]+\.png$/),
  url: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/),
  status: z.enum(['review', 'accepted', 'rejected']),
  origin: z.enum(['upload', 'openai']),
  createdAt: z.string(),
  references: z.array(z.string()),
  checks: z.array(z.string()),
  prompt: z.string().optional(),
  model: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
const backupProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(150),
  club: clubSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  revision: z.number().int().min(0),
  referenceDate: z.string(),
  facts: factsSchema,
  camera: z.enum(cameras.map((c) => c.id) as [string, ...string[]]),
  capacity: z.number().int().min(100000).max(250000),
  seed: z.number().int().min(0).max(1_000_000),
  batch: z.number().int().min(1).max(1000),
  selectedId: z.string().nullable(),
  assets: z.array(assetSchema).max(5000),
  variant: variantSchema,
  playerConsent: z.boolean(),
  notes: z.string().max(4000),
});
export async function restore(file: File) {
  if (file.size > 100 * 1024 * 1024) fail('Yedek en fazla 100 MB olabilir.');
  const parsed = z
    .object({
      format: z.literal('naberlo-html-v1'),
      projects: z.array(backupProjectSchema).max(1000),
      clubs: z.array(clubSchema).max(10000),
    })
    .parse(JSON.parse(await file.text()));
  const projects: Project[] = parsed.projects.map((p) => ({
    ...p,
    candidates: Array.from({ length: p.batch }, (_, i) => createCandidates(p.seed, i + 1)).flat(),
  }));
  for (const p of projects) {
    if (p.selectedId && !p.candidates.some((c) => c.id === p.selectedId))
      fail('Yedekte geçersiz tasarım seçimi var.');
    if (p.assets.some((a) => !validCode(p, a.code))) fail('Yedekte geçersiz görsel aşaması var.');
  }
  // Restored projects get new IDs so existing work is never overwritten.
  for (const p of projects) {
    p.id = crypto.randomUUID();
    p.updatedAt = new Date().toISOString();
  }
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(['projects', 'clubs'], 'readwrite');
    for (const p of projects) transaction.objectStore('projects').put(p);
    for (const c of parsed.clubs) transaction.objectStore('clubs').put(c);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(new Error('Yedek yüklenemedi; tarayıcı depolama alanını kontrol edin.'));
    transaction.onerror = () => {};
  });
  return projects.length;
}

// Standard uncompressed ZIP: portable export without a server or external library.
const encoder = new TextEncoder();
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files: { name: string; data: Uint8Array }[]) {
  const parts: BlobPart[] = [],
    directory: BlobPart[] = [];
  let offset = 0,
    directorySize = 0;
  for (const file of files) {
    const name = encoder.encode(file.name),
      checksum = crc32(file.data);
    const header = new Uint8Array(30 + name.length),
      view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x800, true);
    view.setUint16(12, 33, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    header.set(name, 30);
    parts.push(header, new Uint8Array(file.data));
    const entry = new Uint8Array(46 + name.length),
      e = new DataView(entry.buffer);
    e.setUint32(0, 0x02014b50, true);
    e.setUint16(4, 20, true);
    e.setUint16(6, 20, true);
    e.setUint16(8, 0x800, true);
    e.setUint16(14, 33, true);
    e.setUint32(16, checksum, true);
    e.setUint32(20, file.data.length, true);
    e.setUint32(24, file.data.length, true);
    e.setUint16(28, name.length, true);
    e.setUint32(42, offset, true);
    entry.set(name, 46);
    directory.push(entry);
    directorySize += entry.length;
    offset += header.length + file.data.length;
  }
  const end = new Uint8Array(22),
    e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, directorySize, true);
  e.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end], { type: 'application/zip' });
}
export async function exportProject(url: string, name: string) {
  const id = url.match(/^\/api\/projects\/([^/]+)\/export$/)?.[1];
  if (!id) fail('Geçersiz dışa aktarma isteği.');
  const p = await project(id);
  const files: { name: string; data: Uint8Array }[] = [];
  const add = (name: string, text: string) => files.push({ name, data: encoder.encode(text) });
  add('project.json', JSON.stringify(p, null, 2));
  add('STADIUM-MASTER-v43.txt', master);
  add(
    'README.txt',
    'AI concept project. Human review is required. Prompts are not rendered media. Accepted images are exported at 1080x1920 with padding, never cropped. Use the separate JSON backup to restore your workspace.',
  );
  for (const code of [
    ...stages.filter((s) => s.id !== 'C').map((s) => s.id),
    ...Array.from({ length: 10 }, (_, i) => sheetCode(p.batch, i + 1)),
  ])
    add(`image-prompts/${code}.txt`, imagePrompt(p, code));
  for (const clip of videoPrompts(p))
    add(`${clip.ready ? 'video-prompts' : 'drafts'}/${clip.id}.txt`, clip.prompt);
  for (const asset of p.assets) {
    const blob = await (await fetch(asset.url)).blob();
    files.push({
      name: `images/${asset.code}-${asset.status}-${asset.id}.png`,
      data: new Uint8Array(await blob.arrayBuffer()),
    });
    if (asset.status === 'accepted') {
      const bitmap = await createImageBitmap(blob),
        canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#10120f';
      context.fillRect(0, 0, 1080, 1920);
      const scale = Math.min(1080 / bitmap.width, 1920 / bitmap.height);
      const width = bitmap.width * scale,
        height = bitmap.height * scale;
      context.drawImage(bitmap, (1080 - width) / 2, (1920 - height) / 2, width, height);
      bitmap.close();
      const padded = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Görsel dışa aktarılamadı.'))),
          'image/png',
        ),
      );
      files.push({
        name: `exports-9x16/${asset.code}-${asset.id}.png`,
        data: new Uint8Array(await padded.arrayBuffer()),
      });
    }
  }
  saveBlob(zip(files), name);
}
