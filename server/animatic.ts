import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { Project } from '../shared/types';
import { animaticPlan, animaticSignature } from '../shared/video-state';
import { store, mediaDir } from './store';
import { mediaCommand } from './media';
import { assembleFiles } from './movie';

let rendering = false;
export function startAnimatic(p: Project) {
  if (p.animatic?.status === 'running') return p;
  if (rendering)
    throw Object.assign(
      new Error('Başka bir taslak hazırlanıyor. Kısa süre sonra tekrar deneyin.'),
      { status: 409 },
    );
  const shots = animaticPlan(p),
    configuration = animaticSignature(p),
    id = randomUUID(),
    filename = `${id}-animatic.mp4`;
  p.animatic = { id, status: 'running', configuration };
  store.save(p);
  rendering = true;
  void (async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'naberlo-animatic-'));
    try {
      const inputs: { file: string; in: number; out: number }[] = [];
      for (const shot of shots)
        for (const [i, asset] of [shot.start, shot.end].entries()) {
          const duration = shot.seconds / 2,
            file = path.join(dir, `${shot.code}-${i}.mp4`);
          await mediaCommand('ffmpeg', [
            '-v',
            'error',
            '-loop',
            '1',
            '-i',
            path.join(mediaDir, asset.filename),
            '-t',
            String(duration),
            '-vf',
            `scale=720:1280:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,fade=t=in:st=0:d=0.15,fade=t=out:st=${duration - 0.15}:d=0.15,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='TASLAK / ${shot.code} / ${i ? 'FINAL' : 'BASLANGIC'}':fontcolor=white:fontsize=23:borderw=2:bordercolor=black:x=(w-text_w)/2:y=h*0.85`,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-pix_fmt',
            'yuv420p',
            '-threads',
            '2',
            '-y',
            file,
          ]);
          inputs.push({ file, in: 0, out: duration });
        }
      const info = await assembleFiles(inputs, path.join(mediaDir, filename), {
        title: p.story?.title || '',
        closing: p.story?.closing || '',
        audio: 'mute',
        width: 720,
      });
      const current = store.project(p.id);
      if (!current || current.animatic?.id !== id || animaticSignature(current) !== configuration)
        throw new Error('Taslak hazırlanırken görseller veya ayarlar değişti. Yeniden hazırlayın.');
      current.animatic = {
        ...current.animatic,
        status: 'done',
        filename,
        url: `/media/${filename}`,
        seconds: info.seconds,
      };
      store.save(current);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  })()
    .catch(async (error) => {
      await fs.rm(path.join(mediaDir, filename), { force: true });
      const current = store.project(p.id);
      if (current?.animatic?.id === id) {
        current.animatic.status = 'failed';
        current.animatic.error = error.message;
        store.save(current);
      }
    })
    .finally(() => {
      rendering = false;
    });
  return p;
}
export function approveAnimatic(p: Project, id: string) {
  if (
    p.animatic?.id !== id ||
    p.animatic.status !== 'done' ||
    p.animatic.configuration !== animaticSignature(p)
  )
    throw Object.assign(new Error('Yalnızca güncel, tamamlanmış taslak onaylanabilir.'), {
      status: 409,
    });
  p.animatic.approvedAt = new Date().toISOString();
  return store.save(p);
}
export function recoverAnimatics() {
  for (const p of store.projects())
    if (p.animatic?.status === 'running') {
      p.animatic.status = 'failed';
      p.animatic.error = 'Sunucu yeniden başladı. Yerel taslağı yeniden hazırlayabilirsiniz.';
      store.save(p);
    }
}
