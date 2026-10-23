#!/usr/bin/env bash
set -euo pipefail
if command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null && [[ -f /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf ]]; then
  echo 'Video araçları hazır.'
  exit 0
fi
if ! command -v apt-get >/dev/null; then
  echo 'Bu sistemde FFmpeg ve DejaVu Sans yazı tipini kurun. Codespaces için bu komut otomatik kurar.' >&2
  exit 1
fi
if [[ $(id -u) -eq 0 ]]; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core
else
  sudo apt-get update
  sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core
fi
ffmpeg -version >/dev/null
ffprobe -version >/dev/null
echo 'Video araçları hazır.'
