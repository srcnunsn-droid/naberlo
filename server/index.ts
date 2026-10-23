import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import archiver from 'archiver';
import sharp, { type Metadata } from 'sharp';
import { z } from 'zod';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
try {
  process.loadEnvFile();
} catch {
  /* Optional local configuration. */
}
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) setGlobalDispatcher(new EnvHttpProxyAgent());
const { store, mediaDir } = await import('./store');
const { providerInfo, enqueue, cancelJob, saveImage, invalidateDescendants } =
  await import('./provider');
import type { Club, Fact, FactKey, Project } from '../shared/types';
import {
  createCandidates,
  blockers,
  imagePrompt,
  selectionBlockers,
  videoPrompts,
  accepted,
  dependencies,
  isSheet,
  parseSheet,
  sheetCode,
  resolvedReferences,
} from '../shared/engine';
import { cameras, reviewChecks, stages, variantCounts } from '../shared/catalog';
import { researchClub } from './research';

const app = express();
app.disable('x-powered-by');
const host = process.env.HOST || '127.0.0.1';
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !process.env.STADIUM_ACCESS_TOKEN)
  throw new Error('Dış ağa açmak için STADIUM_ACCESS_TOKEN tanımlayın.');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  if (['POST', 'PATCH', 'DELETE'].includes(req.method) && req.get('origin')) {
    try {
      if (new URL(req.get('origin')!).host !== req.get('host'))
        return res.status(403).json({ error: 'Farklı kaynaktan yazma isteği reddedildi.' });
    } catch {
      return res.status(403).json({ error: 'Geçersiz kaynak.' });
    }
  }
  next();
});
app.use(['/api', '/media'], (req, res, next) => {
  const token = process.env.STADIUM_ACCESS_TOKEN;
  if (!token) return next();
  const supplied = req.get('authorization')?.replace(/^Bearer /, '') || '';
  const a = Buffer.from(token),
    b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return res.status(401).json({ error: 'Stüdyo erişim anahtarı gerekiyor.' });
  next();
});
app.use(express.json({ limit: '5mb' }));
app.use('/media', express.static(mediaDir, { dotfiles: 'deny', immutable: true, maxAge: '1y' }));
const seeds = JSON.parse(fs.readFileSync('data/clubs.json', 'utf8')) as Club[];
const meta = JSON.parse(fs.readFileSync('data/catalog-meta.json', 'utf8'));
const allClubs = () => [...new Map([...seeds, ...store.clubs()].map((c) => [c.id, c])).values()];
const normalize = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ı/g, 'i');
function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
function getProject(id: string) {
  return store.project(id) || fail('Proje bulunamadı.', 404);
}
const url = z
  .string()
  .url()
  .refine((s) => /^https?:\/\//.test(s), 'HTTP/HTTPS kaynak adresi kullanın.');
const factSchema = z
  .object({
    value: z.string().max(3000),
    sources: z.array(url).max(10),
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
  source: url,
  sourceRevision: z.string().max(100).default('user-import'),
});
function validCode(p: Project, code: string) {
  if (
    ['SITE', 'CREST', 'PLAYER', ...stages.map((s) => s.id).filter((s) => s !== 'C')].includes(code)
  )
    return true;
  const s = parseSheet(code);
  return (
    !!s && isSheet(code) && p.candidates.some((c) => c.batch === s.batch && c.sheet === s.sheet)
  );
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'naberlo', version: '1.0.0' }));
app.get('/api/status', (_req, res) =>
  res.json({
    provider: providerInfo(),
    catalog: {
      ...meta,
      total: allClubs().length,
      countries: new Set(allClubs().map((c) => c.country)).size,
    },
    variantCounts,
  }),
);
app.get('/api/clubs', (req, res) => {
  const q = normalize(String(req.query.q || '').slice(0, 200)),
    country = String(req.query.country || ''),
    region = String(req.query.region || '');
  const list = allClubs().filter(
    (c) =>
      (!q || normalize([c.name, c.city, c.country, ...c.aliases].join(' ')).includes(q)) &&
      (!country || c.country === country) &&
      (!region || c.region === region),
  );
  const offset = Math.max(0, Math.trunc(Number(req.query.offset) || 0));
  res.json({
    items: list.slice(offset, offset + 60),
    total: list.length,
    countries: [...new Set(allClubs().map((c) => c.country))].sort(),
  });
});
app.post('/api/clubs/import', (req, res) => {
  const clubs = z.array(clubSchema).min(1).max(5000).parse(req.body);
  store.addClubs(clubs);
  res.json({ imported: clubs.length });
});
app.get('/api/clubs/research/:qid', async (req, res) => {
  const id = z
    .string()
    .regex(/^Q[1-9]\d{0,11}$/)
    .parse(req.params.qid);
  try {
    res.json(await researchClub(id));
  } catch (e) {
    fail((e as Error).message, 502);
  }
});
app.get('/api/clubs/live', async (req, res) => {
  const q = z.string().min(2).max(120).parse(req.query.q);
  try {
    const api = new URL('https://www.wikidata.org/w/api.php');
    api.search = new URLSearchParams({
      action: 'wbsearchentities',
      search: q,
      language: 'en',
      uselang: 'tr',
      format: 'json',
      limit: '15',
    }).toString();
    const r = await fetch(api, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'NaberloStadiumStudio/1.0 (club research)' },
    });
    if (!r.ok) throw new Error('remote');
    const data = (await r.json()) as {
      search?: { id: string; label: string; description?: string }[];
    };
    res.json({
      items: (data.search || [])
        .filter((x) => /football|soccer|futbol/i.test(x.description || ''))
        .map((x) => ({ ...x, source: `https://www.wikidata.org/wiki/${x.id}` })),
      notice: 'Arama sonuçları doğrulanmış kulüp veya stadyum kaydı sayılmaz.',
    });
  } catch {
    fail(
      'Canlı katalog kaynağına erişilemedi. Yerel katalog ve JSON içe aktarma kullanılabilir; www.wikidata.org ağ iznini kontrol edin.',
      502,
    );
  }
});
app.get('/api/projects', (_req, res) =>
  res.json(
    store.projects().map(({ candidates, assets, ...p }) => ({
      ...p,
      candidateCount: candidates.length,
      assetCount: assets.length,
      acceptedCount: assets.filter((a) => a.status === 'accepted').length,
      cover: accepted({ assets } as Project, 'D0')?.url,
    })),
  ),
);
app.post('/api/projects', (req, res) => {
  const input = z
    .object({ clubId: z.string(), name: z.string().max(150).optional() })
    .parse(req.body);
  const club = allClubs().find((c) => c.id === input.clubId) || fail('Kulüp bulunamadı.', 404);
  const blank = (): Fact => ({ value: '', sources: [], status: 'unverified', official: false });
  const facts = Object.fromEntries(factKeys.map((k) => [k, blank()])) as Record<FactKey, Fact>;
  for (const [k, v] of Object.entries({ club: club.name, stadium: club.stadium, city: club.city }))
    if (v)
      facts[k as FactKey] = {
        value: v,
        sources: [club.source],
        status: 'single-source',
        official: false,
      };
  const seed = Math.floor(Math.random() * 1_000_000);
  const now = new Date().toISOString();
  const p: Project = {
    id: randomUUID(),
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
  };
  res.status(201).json(store.save(p));
});
app.get('/api/projects/:id', (req, res) => res.json(getProject(req.params.id)));
app.patch('/api/projects/:id', (req, res) => {
  const p = getProject(req.params.id);
  const input = z
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
      variant: z
        .object({
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
        })
        .optional(),
      playerConsent: z.boolean().optional(),
      notes: z.string().max(4000).optional(),
    })
    .strict()
    .parse(req.body);
  if (input.revision !== p.revision)
    fail('Proje başka bir işlemle güncellendi. Yenileyip tekrar deneyin.', 409);
  const invalidate = ['facts', 'referenceDate', 'camera', 'capacity', 'notes'].some(
    (k) =>
      k in input &&
      JSON.stringify((input as Record<string, unknown>)[k]) !==
        JSON.stringify((p as unknown as Record<string, unknown>)[k]),
  );
  if (invalidate) {
    for (const a of p.assets)
      if (!['SITE', 'CREST', 'PLAYER'].includes(a.code) && a.status === 'accepted')
        a.status = 'review';
  }
  if (input.playerConsent === false) {
    for (const a of p.assets) if (a.code === 'TF3' && a.status === 'accepted') a.status = 'review';
  }
  if (input.variant && input.variant.celebration !== p.variant.celebration) {
    invalidateDescendants(p, 'SH0');
    for (const a of p.assets) if (a.code === 'SH0' && a.status === 'accepted') a.status = 'review';
  }
  Object.assign(p, input);
  res.json(store.save(p));
});
app.delete('/api/projects/:id', (req, res) => {
  getProject(req.params.id);
  for (const j of store.jobs().filter((j) => j.projectId === req.params.id)) cancelJob(j.id);
  store.delete(req.params.id);
  res.json({ deleted: true });
});
app.post('/api/projects/:id/batches', (req, res) => {
  const p = getProject(req.params.id);
  if (p.batch >= 1000) fail('Bu projede 1.000 seri var; yeni proje açın.');
  p.batch++;
  p.candidates.push(...createCandidates(p.seed, p.batch));
  res.json(store.save(p));
});
app.post('/api/projects/:id/select', (req, res) => {
  const p = getProject(req.params.id);
  const id = z.string().parse(req.body.candidateId);
  const c = p.candidates.find((c) => c.id === id) || fail('Tasarım bulunamadı.', 404);
  const issues = selectionBlockers(p, c);
  if (issues.length)
    return res.status(409).json({
      error: 'Seçimden önce serinin 10 kolajı da üretilmeli ve kabul edilmeli.',
      blockers: issues,
    });
  if (p.selectedId !== c.id) {
    invalidateDescendants(p, 'D0');
    for (const a of p.assets) if (a.code === 'D0' && a.status === 'accepted') a.status = 'review';
  }
  p.selectedId = c.id;
  res.json(store.save(p));
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});
app.post('/api/projects/:id/assets', upload.single('image'), async (req, res) => {
  const p = getProject(String(req.params.id)),
    code = z.string().parse(req.body.code);
  if (!validCode(p, code)) fail('Geçersiz görsel kodu.');
  if (!req.file) fail('PNG, JPEG veya WebP görseli seçin.');
  let metadata: Metadata;
  try {
    metadata = await sharp(req.file!.buffer, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    fail('Dosya geçerli bir görsel değil veya piksel sınırını aşıyor.');
  }
  if (!['png', 'jpeg', 'webp'].includes(metadata!.format || ''))
    fail('Yalnızca PNG, JPEG ve WebP kabul edilir.');
  const a = await saveImage(
    req.file!.buffer,
    code,
    'upload',
    dependencies(p, code)
      .map((c) => accepted(p, c)?.id)
      .filter((x): x is string => !!x),
  );
  const current = getProject(p.id);
  current.assets.push(a);
  res.status(201).json(store.save(current));
});
app.post('/api/projects/:id/assets/:assetId/review', (req, res) => {
  const p = getProject(req.params.id),
    asset = p.assets.find((a) => a.id === req.params.assetId) || fail('Görsel bulunamadı.', 404);
  const input = z
    .object({
      status: z.enum(['accepted', 'rejected']),
      checks: z.array(z.enum(reviewChecks as [string, ...string[]])).max(6),
    })
    .parse(req.body);
  if (input.status === 'accepted') {
    if (new Set(input.checks).size !== reviewChecks.length)
      fail('Altı kalite maddesini de kontrol edin.');
    if (!['SITE', 'CREST', 'PLAYER'].includes(asset.code)) {
      const issues = blockers(p, asset.code);
      if (issues.length)
        return res
          .status(409)
          .json({ error: 'Bu görselin ön koşulları henüz tamamlanmadı.', blockers: issues });
    }
    invalidateDescendants(p, asset.code);
    for (const a of p.assets)
      if (a.code === asset.code && a.id !== asset.id && a.status === 'accepted')
        a.status = 'rejected';
    asset.references = resolvedReferences(p, asset.code).map((a) => a.id);
  } else if (asset.status === 'accepted') {
    invalidateDescendants(p, asset.code);
  }
  asset.status = input.status;
  asset.checks = input.checks;
  res.json(store.save(p));
});
app.get('/api/projects/:id/prompts/:code', (req, res) => {
  const p = getProject(req.params.id);
  if (!validCode(p, req.params.code) || ['SITE', 'CREST', 'PLAYER'].includes(req.params.code))
    fail('Geçersiz üretim aşaması.');
  res.json({ prompt: imagePrompt(p, req.params.code), blockers: blockers(p, req.params.code) });
});
app.post('/api/projects/:id/generate', (req, res) => {
  const p = getProject(req.params.id),
    { code } = z.object({ code: z.string() }).parse(req.body);
  if (!validCode(p, code) || ['SITE', 'CREST', 'PLAYER'].includes(code))
    fail('Geçersiz üretim aşaması.');
  if (!providerInfo().configured)
    fail(
      'Görsel servisi bağlı değil. Sunucuda STADIUM_OPENAI_API_KEY tanımlayın veya dışarıda ürettiğiniz görseli yükleyin.',
      503,
    );
  const issues = blockers(p, code);
  if (issues.length)
    return res.status(409).json({ error: 'Üretim ön koşulları tamamlanmadı.', blockers: issues });
  res.status(202).json(enqueue(p, code));
});
app.post('/api/projects/:id/generate-batch', (req, res) => {
  const p = getProject(req.params.id),
    { batch } = z.object({ batch: z.number().int().min(1).max(p.batch) }).parse(req.body);
  if (!providerInfo().configured)
    fail('Görsel servisi bağlı değil. STADIUM_OPENAI_API_KEY tanımlayın.', 503);
  const codes = Array.from({ length: 10 }, (_, i) => sheetCode(batch, i + 1)).filter(
    (c) => !accepted(p, c),
  );
  const issues = [...new Set(codes.flatMap((c) => blockers(p, c)))];
  if (issues.length)
    return res
      .status(409)
      .json({ error: 'Kolaj serisinin ön koşulları tamamlanmadı.', blockers: issues });
  res.status(202).json({ jobs: codes.map((c) => enqueue(p, c)), count: codes.length });
});
app.get('/api/jobs', (_req, res) => res.json(store.jobs().slice(0, 200)));
app.post('/api/jobs/:id/cancel', (req, res) => {
  cancelJob(req.params.id);
  res.json({ ok: true });
});
app.get('/api/projects/:id/videos', (req, res) =>
  res.json(videoPrompts(getProject(req.params.id))),
);
app.get('/api/projects/:id/export', async (req, res) => {
  const p = getProject(req.params.id),
    zip = archiver('zip', { zlib: { level: 6 } });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="naberlo-${p.id.slice(0, 8)}.zip"`);
  zip.on('error', () => res.destroy());
  zip.pipe(res);
  zip.append(JSON.stringify(p, null, 2), { name: 'project.json' });
  zip.append(fs.readFileSync('docs/STADIUM-MASTER-v43.txt'), { name: 'STADIUM-MASTER-v43.txt' });
  zip.append(
    'AI concept project. Only assets marked accepted passed user review. Unverified facts remain unverified. Files under drafts are prompts, not rendered media. Native provider images may be 2:3; 9:16 exports below use padding, never geometry cropping.\n',
    { name: 'README.txt' },
  );
  for (const s of [
    ...stages.filter((s) => s.id !== 'C').map((s) => s.id),
    ...Array.from({ length: 10 }, (_, i) => `${p.batch > 1 ? `B${p.batch}-` : ''}C${i + 1}`),
  ])
    zip.append(imagePrompt(p, s), { name: `image-prompts/${s}.txt` });
  for (const clip of videoPrompts(p))
    zip.append(clip.prompt, { name: `${clip.ready ? 'video-prompts' : 'drafts'}/${clip.id}.txt` });
  for (const a of p.assets) {
    const file = path.join(mediaDir, a.filename);
    if (fs.existsSync(file)) {
      zip.file(file, { name: `images/${a.code}-${a.status}-${a.id}.png` });
      if (a.status === 'accepted') {
        const padded = await sharp(file)
          .resize(1080, 1920, { fit: 'contain', background: '#10120f' })
          .png()
          .toBuffer();
        zip.append(padded, { name: `exports-9x16/${a.code}-${a.id}.png` });
      }
    }
  }
  await zip.finalize();
});
if (fs.existsSync('dist')) {
  app.use(express.static('dist'));
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/media/')) return next();
    res.sendFile(path.resolve('dist/index.html'));
  });
}
app.use((_req, res) => res.status(404).json({ error: 'Adres bulunamadı.' }));
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return res.end();
  if (error instanceof z.ZodError)
    return res
      .status(400)
      .json({ error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  if (error instanceof multer.MulterError)
    return res
      .status(400)
      .json({ error: 'Dosya yüklenemedi. En fazla 15 MB ve tek görsel kullanın.' });
  const e = error as Error & { status?: number };
  res.status(e.status || 500).json({
    error: e.status
      ? e.message
      : 'İşlem tamamlanamadı. Dosya biçimini ve sunucu bağlantısını kontrol edin.',
  });
  if (!e.status) console.error(e.name, e.message.replace(/Bearer\s+\S+/g, 'Bearer [redacted]'));
});
app.listen(Number(process.env.PORT) || 3001, host, () =>
  console.log(`Naberlo API listening on ${host}:${process.env.PORT || 3001}`),
);
