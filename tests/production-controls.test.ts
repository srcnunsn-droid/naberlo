import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { fixture, asset } from './fixtures';
import { currentVideo } from '../shared/video-state';

test('preview approval gates paid videos, actual last frames chain only matching scenes, and AI findings stop automatic continuation', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'naberlo-controls-'));
  process.env.STADIUM_DATA_DIR = dir;
  process.env.STADIUM_OPENAI_API_KEY = 'test-placeholder';
  const { store, mediaDir } = await import('../server/store');
  const { mediaCommand, inspectMedia } = await import('../server/media');
  const { tickAutomation, startAutomation } = await import('../server/automation');
  const { tickVideos, enqueueVideo } = await import('../server/video');
  const { approveAnimatic } = await import('../server/animatic');
  const { analyzeVideo, recoverVideoQuality } = await import('../server/video-quality');
  const original = globalThis.fetch;
  try {
    const png = await sharp({
      create: { width: 180, height: 320, channels: 3, background: '#666666' },
    })
      .png()
      .toBuffer();
    const movies = new Map<number, Buffer>();
    for (const seconds of [4, 8]) {
      const file = path.join(dir, `${seconds}.mp4`);
      await mediaCommand('ffmpeg', [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        `color=c=${seconds === 4 ? 'red' : 'green'}:s=180x320:r=30:d=${seconds}`,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-y',
        file,
      ]);
      movies.set(seconds, await fs.readFile(file));
    }
    let posts = 0,
      reviews = 0,
      invalidTiming = false;
    const remote = new Map<string, number>();
    const openings: number[][] = [];
    globalThis.fetch = async (url, init) => {
      if (String(url).endsWith('/images/edits'))
        return Response.json({ data: [{ b64_json: png.toString('base64') }] });
      if (String(url).endsWith('/videos')) {
        const form = init!.body as FormData,
          seconds = Number(form.get('seconds')),
          id = `video_controls_${++posts}`;
        const opening = Buffer.from(await (form.get('input_reference') as Blob).arrayBuffer());
        const stats = await sharp(opening).stats();
        openings.push(stats.channels.map((c) => c.mean));
        remote.set(id, seconds);
        return Response.json({ id });
      }
      if (String(url).endsWith('/responses')) {
        reviews++;
        const request = JSON.parse(String(init!.body)),
          content = request.input[0].content;
        assert.equal(request.store, false);
        assert.match(content[0].text, /Audio is NOT supplied/);
        assert.equal(
          content.filter((c: any) => c.type === 'input_text' && c.text.startsWith('SAMPLE '))
            .length,
          12,
        );
        assert.ok(content.filter((c: any) => c.type === 'input_image').length >= 14);
        const data = {
          summary: 'Örnekler incelendi.',
          findings:
            reviews === 1 || invalidTiming
              ? [
                  {
                    time: invalidTiming ? 999 : 0,
                    category: 'architecture',
                    severity: 'critical',
                    observation: 'Örnek test bulgusu.',
                    repair: 'Mimariyi inceleyin.',
                  },
                ]
              : [],
        };
        return Response.json({
          output: [
            { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] },
          ],
        });
      }
      const id = String(url).match(/video_controls_\d+/)?.[0];
      if (id && String(url).endsWith('/content'))
        return new Response(new Uint8Array(movies.get(remote.get(id)!)!), {
          headers: { 'content-type': 'video/mp4' },
        });
      if (id) return Response.json({ status: 'completed' });
      throw Error('Unexpected request');
    };
    const p = fixture();
    p.selectedId = 'C1-01';
    p.story = {
      recipeId: 'rebirth',
      autoAssemble: false,
      title: 'İstanbul',
      closing: 'Yeni gece',
      audio: 'mute',
      continuity: true,
      previewFirst: true,
      autoQuality: true,
    };
    p.assets = ['SITE', 'CREST', 'R0', 'E0', 'C1'].map(asset);
    for (const a of p.assets) await fs.writeFile(path.join(mediaDir, a.filename), png);
    store.save(p);
    assert.throws(() => enqueueVideo(p, 'V1', true), /taslağı/);
    const options = { phase: 'production' as const, includeVideos: true, includePlayer: false };
    let run = startAutomation(p, options);
    async function pump(until: () => boolean) {
      for (let i = 0; i < 5000; i++) {
        tickAutomation();
        await tickVideos();
        if (until()) return;
        await new Promise((r) => setTimeout(r, 10));
      }
      assert.fail(JSON.stringify(store.project(p.id)?.animatic));
    }
    await pump(() => store.project(p.id)?.animatic?.status === 'done');
    assert.equal(posts, 0, 'no paid video before preview approval');
    const preview = store.project(p.id)!;
    const info = await inspectMedia(path.join(mediaDir, preview.animatic!.filename!));
    assert.equal(info.width, 720);
    assert.ok(Math.abs(info.seconds - 20) < 0.1);
    assert.throws(
      () =>
        approveAnimatic(
          { ...preview, story: { ...preview.story!, title: 'Changed' } },
          preview.animatic!.id,
        ),
      /güncel/,
    );
    approveAnimatic(preview, preview.animatic!.id);
    await pump(() => store.runs().find((r) => r.id === run.id)?.status === 'failed');
    assert.equal(posts, 1, 'AI finding stops before the next paid video');
    assert.equal(reviews, 1);
    let saved = store.project(p.id)!;
    assert.equal(saved.videos![0].qc, undefined);
    saved.videos![0].qc = {
      status: 'accepted',
      checks: ['reviewed in fixture'],
      at: new Date().toISOString(),
    };
    store.save(saved);
    run = startAutomation(saved, options);
    await pump(() => store.runs().find((r) => r.id === run.id)?.status === 'done');
    saved = store.project(p.id)!;
    assert.equal(posts, 4);
    assert.equal(reviews, 4);
    assert.ok(openings[1][0] > 200 && openings[1][1] < 15, 'V2 receives real red last frame');
    assert.ok(openings[2][1] > 100 && openings[2][0] < 15, 'V3 receives real green last frame');
    assert.ok(
      Math.abs(openings[3][0] - openings[3][1]) < 5,
      'V14 is a camera cut and receives its own gray opening',
    );
    const first = currentVideo(saved, 'V1')!,
      second = currentVideo(saved, 'V2')!;
    assert.equal(second.continuity?.sourceVideoId, first.id);
    assert.equal(saved.videos!.find((v) => v.code === 'V14')!.continuity, undefined);
    saved.videos!.push({ ...first, id: 'replacement' });
    assert.equal(currentVideo(saved, 'V2'), undefined, 'replacement invalidates descendants');
    saved.videos!.pop();
    store.save(saved);
    invalidTiming = true;
    analyzeVideo(saved, second.id);
    for (
      let i = 0;
      i < 3000 &&
      store.project(p.id)!.videos!.find((v) => v.id === second.id)!.quality!.status === 'running';
      i++
    )
      await new Promise((r) => setTimeout(r, 10));
    assert.equal(
      store.project(p.id)!.videos!.find((v) => v.id === second.id)!.quality?.status,
      'failed',
    );
    assert.equal(reviews, 5);
    saved = store.project(p.id)!;
    saved.videos![0].quality!.status = 'running';
    store.save(saved);
    recoverVideoQuality();
    assert.equal(store.project(p.id)!.videos![0].quality?.status, 'failed');
    assert.equal(reviews, 5, 'restart never resends paid analysis');
  } finally {
    globalThis.fetch = original;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
