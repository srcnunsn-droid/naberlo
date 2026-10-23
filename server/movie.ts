import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { Project, VideoAsset } from '../shared/types';
import { storyRecipe } from '../shared/story';
import { automationView, projectSignature } from '../shared/automation';
import { accepted, clipPairs } from '../shared/engine';
import { store, mediaDir } from './store';
import { inspectMedia, mediaCommand } from './media';

export const videoChecks = [
  'Şehir ve kamera sabit',
  'Seçilen mimari korunuyor',
  'Temas ve fizik tutarlı',
  'Arma ve yazılar doğru',
  'Son kare sonraki sahneyle uyumlu',
];
export function currentVideo(p: Project, code: string) {
  const view = automationView(p),
    pair = clipPairs.find((v) => v[0] === code);
  const ids = pair?.slice(2).map((c) => accepted(view, c)?.id);
  return p.videos?.findLast(
    (v) =>
      v.code === code &&
      v.qc?.status !== 'rejected' &&
      v.configuration === projectSignature(p) &&
      JSON.stringify(v.references) === JSON.stringify(ids),
  );
}
export function movieInputs(p: Project) {
  const recipe = storyRecipe(p);
  if (!recipe) throw new Error('Önce bir kısa film akışı seçin.');
  const clips = recipe.shots.map(([code]) => currentVideo(p, code));
  const missing = recipe.shots.filter((_, i) => !clips[i]).map(([code]) => code);
  if (missing.length) throw new Error(`Güncel video eksik veya reddedilmiş: ${missing.join(', ')}`);
  return clips as VideoAsset[];
}
export function movieSignature(p: Project, clips: VideoAsset[]) {
  return JSON.stringify({
    project: projectSignature(p),
    story: p.story,
    sources: clips.map((v) => v.id),
  });
}
export interface EditClip {
  videoId: string;
  in: number;
  out: number;
}
export function wrapCaption(text: string) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/u)) {
    const chunks =
      Array.from(word)
        .join('')
        .match(/.{1,26}/gu) || [];
    for (const chunk of chunks) {
      if (Array.from(line + ' ' + chunk).length > 26 && line) {
        lines.push(line);
        line = '';
      }
      line += (line ? ' ' : '') + chunk;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}
export async function assembleFiles(
  inputs: { file: string; in: number; out: number }[],
  target: string,
  options: {
    title: string;
    closing: string;
    audio: 'source' | 'mute';
    soundtrack?: string;
    width?: number;
  },
) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'naberlo-film-'));
  const width = options.width || 1080,
    height = Math.round((width * 16) / 9 / 2) * 2;
  let total = 0;
  try {
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i],
        info = await inspectMedia(input.file),
        duration = input.out - input.in;
      if (
        !info.hasVideo ||
        input.in < 0 ||
        duration < 0.25 ||
        input.out > info.seconds + 0.05 ||
        !Number.isFinite(duration)
      )
        throw new Error('Klip kesme aralığı dosyanın süresi içinde olmalı.');
      total += duration;
      if (total > 180) throw new Error('Final film 180 saniyeyi aşamaz.');
      const audio = info.hasAudio && options.audio === 'source';
      const args = ['-v', 'error', '-ss', String(input.in), '-i', input.file];
      if (!audio) args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
      args.push(
        '-t',
        String(duration),
        '-map',
        '0:v:0',
        '-map',
        audio ? '0:a:0' : '1:a:0',
        '-vf',
        `scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30`,
        '-af',
        'aresample=48000,asetpts=PTS-STARTPTS',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-ar',
        '48000',
        '-ac',
        '2',
        '-threads',
        '2',
        '-y',
        path.join(dir, `${i}.mp4`),
      );
      await mediaCommand('ffmpeg', args);
    }
    await fs.writeFile(
      path.join(dir, 'list.txt'),
      inputs.map((_, i) => `file '${i}.mp4'`).join('\n'),
    );
    const joined = path.join(dir, 'joined.mp4');
    await mediaCommand('ffmpeg', [
      '-v',
      'error',
      '-f',
      'concat',
      '-safe',
      '1',
      '-i',
      path.join(dir, 'list.txt'),
      '-c',
      'copy',
      '-y',
      joined,
    ]);
    const filters: string[] = [];
    for (const [key, text, start, end] of [
      ['title', options.title, 0, Math.min(2.5, total / 2)],
      ['closing', options.closing, Math.max(total / 2, total - 2.5), total],
    ] as const) {
      if (!text.trim()) continue;
      const file = path.join(dir, `${key}.txt`);
      await fs.writeFile(file, wrapCaption(text));
      filters.push(
        `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=${file}:expansion=none:fontcolor=white:fontsize=${Math.round(width * 0.032)}:borderw=2:bordercolor=black:x=(w-text_w)/2:y=h*0.12:enable='between(t,${start},${end})'`,
      );
    }
    const args = ['-v', 'error', '-i', joined];
    if (options.soundtrack)
      args.push(
        '-stream_loop',
        '-1',
        '-i',
        options.soundtrack,
        '-filter_complex',
        `[1:a]atrim=duration=${total},asetpts=PTS-STARTPTS,volume=0.45,afade=t=out:st=${Math.max(0, total - 0.6)}:d=0.6[music];[0:a][music]amix=inputs=2:duration=first:normalize=0[a]`,
        '-map',
        '0:v:0',
        '-map',
        '[a]',
      );
    else args.push('-map', '0:v:0', '-map', '0:a:0');
    if (filters.length)
      args.push(
        '-vf',
        filters.join(','),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-threads',
        '2',
      );
    else args.push('-c:v', 'copy');
    args.push('-c:a', 'aac', '-t', String(total), '-movflags', '+faststart', '-y', target);
    await mediaCommand('ffmpeg', args);
    const final = await inspectMedia(target);
    if (
      !final.hasVideo ||
      final.width !== width ||
      final.height !== height ||
      Math.abs(final.seconds - total) > 0.2
    )
      throw new Error('Final video doğrulaması geçmedi.');
    return final;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
let rendering = false;
export function startMovie(p: Project, edits?: EditClip[]) {
  if (p.movie?.status === 'running') return p;
  if (rendering)
    throw Object.assign(new Error('Başka bir final film hazırlanıyor. Bitince tekrar deneyin.'), {
      status: 409,
    });
  const clips = movieInputs(p),
    recipe = storyRecipe(p)!,
    id = randomUUID(),
    filename = `${id}-final.mp4`;
  const selections =
    edits ||
    clips.map((v, i) => ({ videoId: v.id, in: 0, out: Math.min(v.seconds, recipe.shots[i][1]) }));
  if (selections.length !== clips.length || selections.some((e, i) => e.videoId !== clips[i].id))
    throw new Error('Kurgu, seçilen akışın güncel klip sırasını kullanmalı.');
  const signature = movieSignature(p, clips);
  const soundtrack = p.story?.soundtrackId
    ? p.soundtracks?.find((a) => a.id === p.story!.soundtrackId)
    : undefined;
  if (p.story?.soundtrackId && !soundtrack) throw new Error('Seçilen ses dosyası bulunamadı.');
  p.movie = {
    id,
    status: 'running',
    createdAt: new Date().toISOString(),
    configuration: signature,
    sourceIds: clips.map((v) => v.id),
    edits: selections,
    reviewed: clips.every((v) => v.qc?.status === 'accepted'),
  };
  store.save(p);
  rendering = true;
  void assembleFiles(
    selections.map((e, i) => ({
      file: path.join(mediaDir, clips[i].filename),
      in: e.in,
      out: e.out,
    })),
    path.join(mediaDir, filename),
    {
      title: p.story?.title || '',
      closing: p.story?.closing || '',
      audio: p.story?.audio || 'source',
      soundtrack: soundtrack ? path.join(mediaDir, soundtrack.filename) : undefined,
    },
  )
    .then(async (info) => {
      const current = store.project(p.id);
      if (
        !current ||
        current.movie?.id !== id ||
        movieSignature(current, movieInputs(current)) !== signature
      )
        throw new Error(
          'Kurgu sırasında proje veya klipler değişti. Eski film güncel çıktı olarak kaydedilmedi.',
        );
      current.movie = {
        ...current.movie,
        status: 'done',
        filename,
        url: `/media/${filename}`,
        seconds: info.seconds,
      };
      store.save(current);
    })
    .catch(async (error) => {
      await fs.rm(path.join(mediaDir, filename), { force: true });
      const current = store.project(p.id);
      if (current?.movie?.id === id) {
        current.movie.status = 'failed';
        current.movie.error = error.message;
        store.save(current);
      }
    })
    .finally(() => {
      rendering = false;
    });
  return p;
}
export function recoverMovies() {
  for (const p of store.projects())
    if (p.movie?.status === 'running') {
      p.movie.status = 'failed';
      p.movie.error =
        'Sunucu yeniden başladı. Final MP4 birleştirmeyi tekrar başlatabilirsiniz; yeni AI üretimi yapılmaz.';
      store.save(p);
    }
}
