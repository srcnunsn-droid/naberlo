import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { fixture, asset } from './fixtures';
import { automationPlan, automationView } from '../shared/automation';
import { accepted } from '../shared/engine';

let dir: string,
  storage: typeof import('../server/store'),
  automation: typeof import('../server/automation'),
  video: typeof import('../server/video');
const originalFetch = globalThis.fetch;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'naberlo-auto-'));
  process.env.STADIUM_DATA_DIR = dir;
  process.env.STADIUM_OPENAI_API_KEY = 'test-placeholder';
  storage = await import('../server/store');
  automation = await import('../server/automation');
  video = await import('../server/video');
});
after(async () => {
  globalThis.fetch = originalFetch;
  await rm(dir, { recursive: true, force: true });
});

test('full unattended preview/image/video graph preserves real references and never records fake QC approval', async () => {
  const p = fixture();
  p.assets = [asset('SITE'), asset('CREST')];
  storage.store.save(p);
  const bytes = await sharp({
    create: { width: 64, height: 96, channels: 3, background: '#39785b' },
  })
    .png()
    .toBuffer();
  for (const a of p.assets) await writeFile(path.join(storage.mediaDir, a.filename), bytes);
  let imageCalls = 0,
    videoCalls = 0;
  const mp4 = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex');
  globalThis.fetch = async (url, init) => {
    if (url === 'https://api.openai.com/v1/images/edits') {
      imageCalls++;
      const form = init?.body as FormData;
      assert.ok(form.getAll('image[]').length > 0);
      for (const ref of form.getAll('image[]')) assert.ok((ref as Blob).size > 0);
      return Response.json({ data: [{ b64_json: bytes.toString('base64') }] });
    }
    if (url === 'https://api.openai.com/v1/videos') {
      videoCalls++;
      const form = init?.body as FormData;
      assert.equal(form.get('seconds'), '12');
      assert.equal(form.get('size'), '720x1280');
      assert.equal(form.get('model'), 'sora-2');
      const metadata = await sharp(
        Buffer.from(await (form.get('input_reference') as Blob).arrayBuffer()),
      ).metadata();
      assert.equal(metadata.width, 720);
      assert.equal(metadata.height, 1280);
      assert.match(String(form.get('prompt')), /12-second/);
      assert.doesNotMatch(String(form.get('prompt')), /@image-2|10-second|TARGET: Seedance/);
      return Response.json({ id: `video_test_${videoCalls}`, status: 'queued' });
    }
    if (String(url).endsWith('/content'))
      return new Response(mp4, { headers: { 'content-type': 'video/mp4' } });
    if (/\/videos\/video_test_\d+$/.test(String(url)))
      return Response.json({ status: 'completed', progress: 100 });
    throw new Error(`Unexpected request ${url}`);
  };
  const options = { phase: 'previews' as const, includeVideos: true, includePlayer: false };
  assert.deepEqual(automationPlan(p, options).issues, []);
  const preview = automation.startAutomation(p, options);
  assert.equal(automation.startAutomation(p, options).id, preview.id);
  async function finish(id: string) {
    for (let i = 0; i < 1000; i++) {
      automation.tickAutomation();
      await video.tickVideos();
      const current = storage.store.runs().find((r) => r.id === id)!;
      if (current.status !== 'running') {
        assert.equal(current.status, 'done', current.error);
        return current;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Automation timed out');
  }
  await finish(preview.id);
  let saved = storage.store.project(p.id)!;
  assert.equal(imageCalls, 12);
  assert.ok(
    saved.assets
      .filter((a) => a.origin === 'openai')
      .every((a) => a.status === 'review' && a.checks.length === 0),
  );
  saved.selectedId = 'C1-01';
  storage.store.save(saved);
  assert.ok(
    accepted(automationView(saved), 'C1'),
    'choosing a design must keep its generated preview usable',
  );
  const production = automation.startAutomation(saved, { ...options, phase: 'production' });
  const finished = await finish(production.id);
  assert.equal(imageCalls, 30);
  assert.equal(videoCalls, 11);
  saved = storage.store.project(p.id)!;
  assert.equal(saved.videos?.length, 11);
  assert.ok(saved.videos?.every((v) => v.status === 'review'));
  assert.equal(saved.assets.filter((a) => a.status === 'accepted').length, 2);
  assert.deepEqual(await readFile(path.join(storage.mediaDir, saved.videos![0].filename)), mp4);
  assert.ok(finished.steps.every((s) => s.status === 'done'));
  const repeated = automation.startAutomation(saved, { ...options, phase: 'production' });
  assert.ok((await finish(repeated.id)).steps.every((s) => s.status === 'reused'));
  assert.equal(imageCalls, 30);
  assert.equal(videoCalls, 11);
  const replacement = { ...asset('SITE'), id: 'replacement-site' };
  saved.assets.push(replacement);
  assert.equal(
    accepted(automationView(saved), 'R0'),
    undefined,
    'replacing a source invalidates unreviewed downstream references',
  );
});

test('failed video polling resumes with GET only, and uncertain creation never retries automatically', async () => {
  const p = fixture();
  p.id = 'video-errors';
  p.assets = [asset('R0'), asset('E0')];
  storage.store.save(p);
  const bytes = await sharp({
    create: { width: 32, height: 48, channels: 3, background: '#558855' },
  })
    .png()
    .toBuffer();
  await writeFile(path.join(storage.mediaDir, 'R0.png'), bytes);
  let posts = 0,
    polls = 0;
  globalThis.fetch = async (url, init) => {
    if (init?.method === 'POST') {
      posts++;
      return Response.json({ id: 'video_recover' });
    }
    polls++;
    return new Response('{}', { status: 503 });
  };
  const job = video.enqueueVideo(p, 'V1');
  await video.tickVideos();
  await video.tickVideos();
  assert.equal(storage.store.jobs().find((j) => j.id === job.id)?.status, 'failed');
  video.resumeVideo(job.id);
  await video.tickVideos();
  assert.equal(posts, 1);
  assert.equal(polls, 2);
  globalThis.fetch = async () => {
    posts++;
    throw new Error('Connection lost after submission');
  };
  const uncertain = video.enqueueVideo(p, 'V1');
  await video.tickVideos();
  await video.tickVideos();
  assert.equal(posts, 2);
  assert.equal(storage.store.jobs().find((j) => j.id === uncertain.id)?.status, 'failed');
  assert.throws(() => video.resumeVideo(uncertain.id));
});

test('automation plan reports real missing prerequisites and stops when project configuration changes', () => {
  const p = fixture();
  p.id = 'blocked';
  const options = { phase: 'production' as const, includeVideos: true, includePlayer: true };
  const plan = automationPlan(p, options);
  assert.ok(plan.issues.some((s) => s.includes('tasarımı seçilmeli')));
  assert.ok(plan.issues.some((s) => s.includes('Oyuncu seçimi')));
  p.assets = [asset('SITE')];
  storage.store.save(p);
  const run = automation.startAutomation(p, {
    phase: 'previews',
    includeVideos: false,
    includePlayer: false,
  });
  p.capacity = 150000;
  storage.store.save(p);
  automation.tickAutomation();
  assert.equal(storage.store.runs().find((r) => r.id === run.id)?.status, 'failed');
});
