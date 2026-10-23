import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { fixture } from './fixtures';

test('reference analysis sends actual timestamped frames, rejects impossible timing and never retries a billed failure', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'naberlo-ref-analysis-'));
  process.env.STADIUM_DATA_DIR = dir;
  process.env.STADIUM_OPENAI_API_KEY = 'test-placeholder';
  const { store, mediaDir } = await import('../server/store');
  const { analyzeReference, recoverReferenceAnalysis } =
    await import('../server/reference-analysis');
  const original = globalThis.fetch;
  try {
    const jpg = await sharp({
      create: { width: 240, height: 426, channels: 3, background: '#aabbcc' },
    })
      .jpeg()
      .toBuffer();
    await fs.writeFile(path.join(mediaDir, 'frame.jpg'), jpg);
    const p = fixture();
    p.references = [
      {
        id: 'ref',
        filename: 'reference.mp4',
        name: 'Reference',
        url: '/media/reference.mp4',
        seconds: 16,
        width: 478,
        height: 850,
        fps: 30,
        hasAudio: true,
        createdAt: '2026-10-23',
        frames: Array.from({ length: 12 }, (_, i) => ({
          time: i,
          filename: 'frame.jpg',
          url: '/media/frame.jpg',
        })),
      },
    ];
    store.save(p);
    let calls = 0,
      mode = 'valid';
    globalThis.fetch = async (_url, init) => {
      calls++;
      const request = JSON.parse(String(init!.body));
      assert.equal(request.store, false);
      const content = request.input[0].content;
      assert.match(content[0].text, /Audio is NOT supplied/);
      const images = content.filter((c: any) => c.type === 'input_image');
      assert.equal(images.length, 12);
      assert.equal(images[0].image_url, `data:image/jpeg;base64,${jpg.toString('base64')}`);
      assert.match(content[23].text, /11.000 seconds/);
      if (mode === 'failure') return new Response('', { status: 429 });
      const result = {
        summary: 'Görünen kumaş hareketi.',
        recipeId: 'road',
        beats: [
          {
            from: 0,
            to: mode === 'invalid' ? 99 : 4,
            observation: 'Kumaş açılıyor.',
            camera: 'Örneklerde sabit.',
            risk: 'Aradaki hareket görülmüyor.',
          },
        ],
      };
      return Response.json({
        output: [
          { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] },
        ],
      });
    };
    async function run() {
      analyzeReference(store.project(p.id)!, 'ref');
      for (
        let i = 0;
        i < 100 && store.project(p.id)!.references![0].analysis?.status === 'running';
        i++
      )
        await new Promise((r) => setTimeout(r, 10));
      return store.project(p.id)!.references![0].analysis!;
    }
    assert.equal((await run()).status, 'done');
    assert.equal(calls, 1);
    mode = 'invalid';
    assert.equal((await run()).status, 'failed');
    assert.equal(calls, 2);
    mode = 'failure';
    assert.match((await run()).error!, /429/);
    assert.equal(calls, 3);
    const interrupted = store.project(p.id)!;
    interrupted.references![0].analysis = { status: 'running' };
    store.save(interrupted);
    recoverReferenceAnalysis();
    assert.equal(store.project(p.id)!.references![0].analysis?.status, 'failed');
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = original;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
