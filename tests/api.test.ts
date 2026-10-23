import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { reviewChecks } from '../shared/catalog';
let child: ChildProcess, dir: string;
const base = 'http://127.0.0.1:4181';
async function request(url: string, method = 'GET', body?: unknown) {
  const r = await fetch(base + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: (await r.json()) as any };
}
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'naberlo-api-'));
  child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: '4181',
      HOST: '127.0.0.1',
      STADIUM_DATA_DIR: dir,
      STADIUM_OPENAI_API_KEY: '',
      OPENAI_API_KEY: '',
      STADIUM_ACCESS_TOKEN: '',
    },
    stdio: 'pipe',
  });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await request('/api/health')).status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error('test server did not start');
});
after(async () => {
  child?.kill();
  await new Promise((r) => setTimeout(r, 150));
  await rm(dir, { recursive: true, force: true });
});
test('full persisted project, fact review, upload, dependency invalidation and export', async () => {
  const search = await request('/api/clubs?q=Fenerbahce');
  assert.equal(search.status, 200);
  assert.ok(search.data.items.some((c: any) => c.name.includes('Fenerbahçe')));
  const result = await request('/api/projects', 'POST', { clubId: search.data.items[0].id });
  assert.equal(result.status, 201);
  let p = result.data;
  const root = `/api/projects/${p.id}`;
  assert.equal(p.candidates.length, 100);
  assert.equal((await request(root + '/select', 'POST', { candidateId: 'C1-01' })).status, 409);
  assert.equal((await request(root + '/generate', 'POST', { code: 'R0' })).status, 503);
  const missingSource = {
    ...p.facts,
    club: { value: 'test', sources: [], official: true, status: 'verified' },
  };
  assert.equal(
    (await request(root, 'PATCH', { revision: p.revision, facts: missingSource })).status,
    400,
  );
  const facts = Object.fromEntries(
    Object.keys(p.facts).map((k) => [
      k,
      {
        value: `Test ${k}`,
        sources: ['https://example.org/official'],
        official: true,
        status: 'verified',
      },
    ]),
  );
  p = (await request(root, 'PATCH', { revision: p.revision, facts })).data;
  assert.equal(p.facts.club.status, 'verified');
  assert.equal((await request(root, 'PATCH', { revision: 0, name: 'stale' })).status, 409);
  const pixels = await sharp({
    create: { width: 64, height: 96, channels: 3, background: '#20422b' },
  })
    .png()
    .toBuffer();
  async function upload(code: string) {
    const form = new FormData();
    form.set('code', code);
    form.set('image', new Blob([pixels], { type: 'image/png' }), 'fixture.png');
    const r = await fetch(base + root + '/assets', { method: 'POST', body: form });
    assert.equal(r.status, 201);
    return (await r.json()) as any;
  }
  p = await upload('SITE');
  const site = p.assets.at(-1);
  assert.equal(site.status, 'review');
  assert.equal(
    (await request(root + `/assets/${site.id}/review`, 'POST', { status: 'accepted', checks: [] }))
      .status,
    400,
  );
  p = (
    await request(root + `/assets/${site.id}/review`, 'POST', {
      status: 'accepted',
      checks: reviewChecks,
    })
  ).data;
  p = await upload('R0');
  const r0 = p.assets.at(-1);
  p = (
    await request(root + `/assets/${r0.id}/review`, 'POST', {
      status: 'accepted',
      checks: reviewChecks,
    })
  ).data;
  assert.equal(p.assets.find((a: any) => a.id === r0.id).status, 'accepted');
  p = await upload('E0');
  const e0 = p.assets.at(-1);
  p = (
    await request(root + `/assets/${e0.id}/review`, 'POST', {
      status: 'accepted',
      checks: reviewChecks,
    })
  ).data;
  p = await upload('R0');
  const replacement = p.assets.at(-1);
  p = (
    await request(root + `/assets/${replacement.id}/review`, 'POST', {
      status: 'accepted',
      checks: reviewChecks,
    })
  ).data;
  assert.equal(p.assets.find((a: any) => a.id === e0.id).status, 'rejected');
  assert.equal(p.assets.find((a: any) => a.id === r0.id).status, 'rejected');
  const zip = await fetch(base + root + '/export');
  assert.equal(zip.status, 200);
  const bytes = Buffer.from(await zip.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  assert.ok(bytes.length > 10000);
  p = (await request(root + '/batches', 'POST')).data;
  assert.equal(p.candidates.length, 200);
  assert.ok(p.candidates.some((c: any) => c.id === 'B2-C10-10'));
  const same = (await request(root)).data;
  assert.equal(same.candidates.length, 200);
  assert.equal(same.assets.length, 4);
  const cors = await fetch(base + root, {
    method: 'PATCH',
    headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: same.revision, name: 'bad' }),
  });
  assert.equal(cors.status, 403);
  assert.equal((await request(root, 'DELETE')).status, 200);
  assert.equal((await request(root)).status, 404);
});
test('catalog import validates sources and persists additions', async () => {
  assert.equal(
    (
      await request('/api/clubs/import', 'POST', [
        { id: 'x', name: 'Test club', country: 'Test', source: 'javascript:bad' },
      ])
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/api/clubs/import', 'POST', [
        {
          id: 'custom-test',
          name: 'Unique Test Club',
          country: 'Test',
          source: 'https://example.org/club',
        },
      ])
    ).status,
    200,
  );
  assert.equal((await request('/api/clubs?q=Unique%20Test%20Club')).data.total, 1);
});
