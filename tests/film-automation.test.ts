import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { fixture, asset } from './fixtures';

test('selected recipe renders four native-duration clips and automatically assembles a real 20 second draft MP4', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'naberlo-film-flow-'));
  process.env.STADIUM_DATA_DIR = dir;
  process.env.STADIUM_OPENAI_API_KEY = 'test-placeholder';
  const { store, mediaDir } = await import('../server/store'),
    media = await import('../server/media'),
    automation = await import('../server/automation'),
    video = await import('../server/video');
  const original = globalThis.fetch;
  try {
    const png = await sharp({
      create: { width: 100, height: 150, channels: 3, background: '#558877' },
    })
      .png()
      .toBuffer();
    const movies = new Map<number, Buffer>();
    for (const seconds of [4, 8]) {
      const file = path.join(dir, `${seconds}.mp4`);
      await media.mediaCommand('ffmpeg', [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        `color=c=green:s=180x320:r=30:d=${seconds}`,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-y',
        file,
      ]);
      movies.set(seconds, await fs.readFile(file));
    }
    const durations: number[] = [],
      remote = new Map<string, number>();
    let calls = 0;
    globalThis.fetch = async (url, init) => {
      if (String(url).endsWith('/images/edits'))
        return Response.json({ data: [{ b64_json: png.toString('base64') }] });
      if (String(url).endsWith('/videos')) {
        const form = init!.body as FormData,
          n = Number(form.get('seconds')),
          id = `video_recipe_${++calls}`;
        durations.push(n);
        assert.match(String(form.get('prompt')), new RegExp(`${n}-second`));
        remote.set(id, n);
        return Response.json({ id });
      }
      const id = String(url).match(/video_recipe_\d+/)?.[0];
      if (id && String(url).endsWith('/content'))
        return new Response(new Uint8Array(movies.get(remote.get(id)!)!), {
          headers: { 'content-type': 'video/mp4' },
        });
      if (id) return Response.json({ status: 'completed' });
      throw Error('Unexpected mock request');
    };
    const p = fixture();
    p.selectedId = 'C1-01';
    p.story = {
      recipeId: 'rebirth',
      autoAssemble: true,
      title: 'İstanbul',
      closing: 'Yeni stadyum',
      audio: 'mute',
    };
    p.assets = ['SITE', 'CREST', 'R0', 'E0', 'C1'].map(asset);
    for (const a of p.assets) await fs.writeFile(path.join(mediaDir, a.filename), png);
    store.save(p);
    const run = automation.startAutomation(p, {
      phase: 'production',
      includeVideos: true,
      includePlayer: false,
    });
    for (let i = 0; i < 1500; i++) {
      automation.tickAutomation();
      await video.tickVideos();
      const current = store.runs().find((r) => r.id === run.id)!;
      if (current.status !== 'running') {
        assert.equal(current.status, 'done', current.error);
        break;
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.deepEqual(durations, [4, 8, 4, 4]);
    for (let i = 0; i < 2400 && store.project(p.id)?.movie?.status === 'running'; i++)
      await new Promise((r) => setTimeout(r, 25));
    const saved = store.project(p.id)!;
    assert.equal(saved.movie?.status, 'done', saved.movie?.error);
    assert.equal(saved.movie.reviewed, false);
    assert.equal(saved.movie.sourceIds.length, 4);
    const final = await media.inspectMedia(path.join(mediaDir, saved.movie.filename!));
    assert.ok(Math.abs(final.seconds - 20) < 0.2);
    assert.equal(final.width, 1080);
    assert.equal(final.height, 1920);
  } finally {
    globalThis.fetch = original;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
