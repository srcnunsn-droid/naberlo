import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mediaDir } from './store';
import type { ReferenceVideo } from '../shared/types';
export function mediaCommand(bin: string, args: string[], timeout = 180000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '',
      err = '',
      expired = false;
    const timer = setTimeout(() => {
      expired = true;
      child.kill('SIGKILL');
    }, timeout);
    child.stdout.on('data', (b) => {
      out += b;
      if (out.length > 2_000_000) child.kill('SIGKILL');
    });
    child.stderr.on('data', (b) => {
      err = (err + b).slice(-4000);
    });
    child.once('error', (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        new Error(
          e.code === 'ENOENT'
            ? 'FFmpeg/ffprobe bulunamadı. Medya araçlarını kurun: bash scripts/install-media-tools.sh'
            : 'Medya aracı başlatılamadı.',
        ),
      );
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(out)
        : reject(
            new Error(
              expired
                ? 'Medya işlemi süre sınırını aştı.'
                : `Medya dosyası işlenemedi: ${err.slice(-700)}`,
            ),
          );
    });
  });
}
export async function inspectMedia(file: string) {
  const raw = JSON.parse(
    await mediaCommand(
      'ffprobe',
      [
        '-v',
        'error',
        '-protocol_whitelist',
        'file,pipe',
        '-show_streams',
        '-show_format',
        '-of',
        'json',
        file,
      ],
      20000,
    ),
  );
  const video = raw.streams?.find((s: any) => s.codec_type === 'video'),
    audio = raw.streams?.find((s: any) => s.codec_type === 'audio');
  const seconds = Number(raw.format?.duration),
    parts = String(video?.avg_frame_rate || '0/1')
      .split('/')
      .map(Number);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 180)
    throw new Error('Medya süresi 0–180 saniye arasında olmalı.');
  if (
    video &&
    (!Number.isFinite(video.width * video.height) || video.width * video.height > 17_000_000)
  )
    throw new Error('Video çözünürlüğü desteklenen sınırı aşıyor.');
  return {
    seconds,
    width: Number(video?.width || 0),
    height: Number(video?.height || 0),
    fps: parts[0] / (parts[1] || 1),
    hasAudio: !!audio,
    hasVideo: !!video,
  };
}
export async function importReference(file: string, name: string): Promise<ReferenceVideo> {
  const info = await inspectMedia(file);
  if (!info.hasVideo) throw new Error('Dosyada video kanalı bulunamadı.');
  const id = randomUUID(),
    filename = `${id}-reference.mp4`,
    target = path.join(mediaDir, filename),
    frames: ReferenceVideo['frames'] = [];
  try {
    await mediaCommand('ffmpeg', [
      '-v',
      'error',
      '-protocol_whitelist',
      'file,pipe',
      '-i',
      file,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-vf',
      'scale=720:1280:force_original_aspect_ratio=decrease:force_divisible_by=2',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '24',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      '-y',
      target,
    ]);
    for (let i = 0; i < 12; i++) {
      const time = Math.max(0, ((info.seconds - 0.08) * i) / 11),
        thumb = `${id}-frame-${i}.jpg`;
      await mediaCommand(
        'ffmpeg',
        [
          '-v',
          'error',
          '-ss',
          time.toFixed(3),
          '-i',
          target,
          '-frames:v',
          '1',
          '-vf',
          'scale=240:-2',
          '-y',
          path.join(mediaDir, thumb),
        ],
        20000,
      );
      frames.push({ time, filename: thumb, url: `/media/${thumb}` });
    }
    return {
      id,
      name: name.slice(0, 180),
      filename,
      url: `/media/${filename}`,
      ...info,
      frames,
      createdAt: new Date().toISOString(),
    };
  } catch (e) {
    await Promise.all(
      [filename, ...frames.map((f) => f.filename)].map((f) =>
        fs.rm(path.join(mediaDir, f), { force: true }),
      ),
    );
    throw e;
  }
}
