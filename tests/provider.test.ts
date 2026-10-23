import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { fixture, asset } from './fixtures';
let dir: string;
let provider: typeof import('../server/provider'), storeModule: typeof import('../server/store');
const originalFetch = globalThis.fetch;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'naberlo-provider-'));
  process.env.STADIUM_DATA_DIR = dir;
  process.env.STADIUM_OPENAI_API_KEY = 'test-placeholder';
  provider = await import('../server/provider');
  storeModule = await import('../server/store');
});
after(async () => {
  globalThis.fetch = originalFetch;
  await rm(dir, { recursive: true, force: true });
});
async function wait(id: string) {
  for (let i = 0; i < 100; i++) {
    const j = storeModule.store.jobs().find((j) => j.id === id)!;
    if (!['running', 'queued'].includes(j.status)) return j;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error('job timed out');
}
test('provider submits real reference bytes, records a review asset, and never retries a billing failure', async () => {
  const p = fixture();
  const site = asset('SITE');
  p.assets.push(site);
  storeModule.store.save(p);
  const bytes = await sharp({
    create: { width: 32, height: 48, channels: 3, background: '#23412e' },
  })
    .png()
    .toBuffer();
  await writeFile(path.join(storeModule.mediaDir, site.filename), bytes);
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    assert.equal(input, 'https://api.openai.com/v1/images/edits');
    assert.equal(init?.method, 'POST');
    const form = init?.body as FormData;
    assert.equal(form.getAll('image[]').length, 1);
    assert.equal(form.get('n'), '1');
    assert.equal(form.get('size'), '1024x1536');
    assert.match(String(form.get('prompt')), /authentic existing stadium/);
    assert.equal((form.getAll('image[]')[0] as Blob).size, bytes.length);
    return new Response(JSON.stringify({ data: [{ b64_json: bytes.toString('base64') }] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const j = provider.enqueue(p, 'R0');
  assert.equal(provider.enqueue(p, 'R0').id, j.id);
  const done = await wait(j.id);
  assert.equal(done.status, 'done');
  assert.equal(calls, 1);
  const saved = storeModule.store.project(p.id)!;
  const output = saved.assets.at(-1)!;
  assert.equal(output.status, 'review');
  assert.deepEqual(output.references, [site.id]);
  assert.equal(output.width, 32);
  assert.ok(output.prompt);
  globalThis.fetch = async () => {
    calls++;
    return new Response('{}', { status: 429 });
  };
  const fail = provider.enqueue(saved, 'R0');
  const failed = await wait(fail.id);
  assert.equal(failed.status, 'failed');
  assert.match(failed.error!, /kota/);
  assert.equal(calls, 2);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(calls, 2);
});

test('replacing an optional crest invalidates every actual dependent reference', () => {
  const p = fixture();
  const crest = asset('CREST');
  const r0 = { ...asset('R0'), references: [crest.id] };
  const e0 = { ...asset('E0'), references: [r0.id] };
  p.assets = [crest, r0, e0];
  provider.invalidateDescendants(p, 'CREST');
  assert.equal(r0.status, 'rejected');
  assert.equal(e0.status, 'rejected');
  assert.equal(crest.status, 'accepted');
});
