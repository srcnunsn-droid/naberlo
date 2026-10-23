import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
let dir: string, media: typeof import('../server/media'), movie: typeof import('../server/movie');
before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'naberlo-movie-test-'));
  process.env.STADIUM_DATA_DIR = dir;
  media = await import('../server/media');
  movie = await import('../server/movie');
});
after(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});
test('real FFmpeg assembly orders clips, handles missing audio, renders Turkish text and validates portrait output', async () => {
  const red = path.join(dir, 'red.mp4'),
    blue = path.join(dir, 'blue.mp4'),
    final = path.join(dir, 'final.mp4');
  await media.mediaCommand('ffmpeg', [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=red:s=180x320:r=30:d=1',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=1',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    '-y',
    red,
  ]);
  await media.mediaCommand('ffmpeg', [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=blue:s=180x320:r=30:d=1',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-y',
    blue,
  ]);
  const result = await movie.assembleFiles(
    [
      { file: red, in: 0, out: 1 },
      { file: blue, in: 0, out: 1 },
    ],
    final,
    {
      title: 'İstanbul · Çığlık % test: tribünlerden şehre uzanan renkler ve unutulmaz bir gece',
      closing: 'Şampiyon',
      audio: 'source',
    },
  );
  assert.ok(
    movie
      .wrapCaption('WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW')
      .split('\n')
      .every((line) => line.length <= 26),
  );
  assert.equal(result.width, 1080);
  assert.equal(result.height, 1920);
  assert.ok(Math.abs(result.seconds - 2) < 0.1);
  assert.equal(result.hasAudio, true);
  for (const [time, channel] of [
    [0.4, 0],
    [1.4, 2],
  ] as const) {
    const out = path.join(dir, `pixel-${channel}.rgb`);
    await media.mediaCommand('ffmpeg', [
      '-v',
      'error',
      '-ss',
      String(time),
      '-i',
      final,
      '-frames:v',
      '1',
      '-vf',
      'crop=2:2:540:960',
      '-pix_fmt',
      'rgb24',
      '-f',
      'rawvideo',
      '-y',
      out,
    ]);
    const pixel = await fs.readFile(out);
    assert.ok(pixel[channel] > 200);
    assert.ok(pixel[2 - channel] < 30);
  }
  const ref = await media.importReference(final, 'Reference.mp4');
  assert.equal(ref.frames.length, 12);
  assert.equal(ref.hasAudio, true);
  assert.ok(ref.frames[11].time < ref.seconds);
  for (const f of ref.frames)
    assert.ok((await fs.stat(path.join(dir, 'media', f.filename))).size > 100);
  await assert.rejects(
    () =>
      movie.assembleFiles([{ file: red, in: 0, out: 4 }], path.join(dir, 'invalid.mp4'), {
        title: '',
        closing: '',
        audio: 'mute',
      }),
    /kesme aralığı/,
  );
});
