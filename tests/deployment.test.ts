import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('public hosting health check and login shell keep project API and media private', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'naberlo-deployment-'));
  const token = 'deployment-test-only';
  const base = 'http://127.0.0.1:4182';
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    env: {
      ...process.env,
      HOST: '0.0.0.0',
      PORT: '4182',
      STADIUM_DATA_DIR: dir,
      STADIUM_ACCESS_TOKEN: token,
      STADIUM_OPENAI_API_KEY: '',
      OPENAI_API_KEY: '',
      STADIUM_PUBLIC_ORIGIN: 'https://test-workspace-4182.app.github.dev',
    },
    stdio: 'pipe',
  });
  let output = '';
  child.stderr.on('data', (chunk) => (output += chunk));
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try {
        const response = await fetch(base + '/healthz');
        if (response.ok) {
          assert.deepEqual(await response.json(), { ok: true });
          ready = true;
          break;
        }
      } catch {}
      if (child.exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, `Hosting server failed to start: ${output}`);
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<div id="root"><\/div>/);
    for (const route of ['/api/health', '/api/projects', '/media/private.png']) {
      assert.equal((await fetch(base + route)).status, 401);
      assert.equal(
        (await fetch(base + route, { headers: { Authorization: 'Bearer wrong' } })).status,
        401,
      );
    }
    const headers = { Authorization: `Bearer ${token}` };
    assert.equal((await fetch(base + '/api/health', { headers })).status, 200);
    const clubs = await fetch(base + '/api/clubs?q=Fenerbahce', { headers });
    assert.equal(clubs.status, 200);
    assert.ok((await clubs.json()).items.length > 0);
    const forwarded = await fetch(base + '/api/projects', {
      method: 'POST',
      headers: {
        ...headers,
        Origin: 'https://test-workspace-4182.app.github.dev',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clubId: 'missing-club' }),
    });
    assert.equal(forwarded.status, 404);
    assert.equal(
      (
        await fetch(base + '/api/projects', {
          method: 'POST',
          headers: { ...headers, Origin: 'https://another.example' },
        })
      ).status,
      403,
    );
  } finally {
    if (child.exitCode === null) {
      const stopped = once(child, 'exit');
      child.kill();
      await stopped;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
