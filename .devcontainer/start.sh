#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
export HOST=127.0.0.1
export PORT="${PORT:-3001}"
if [[ -n "${CODESPACE_NAME:-}" && -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
  export STADIUM_PUBLIC_ORIGIN="https://${CODESPACE_NAME}-${PORT}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
fi
check_ready() {
  node --input-type=module -e '
    const response = await fetch(`http://127.0.0.1:${process.env.PORT}/api/health`, {
      signal: AbortSignal.timeout(1500),
      headers: process.env.STADIUM_ACCESS_TOKEN ? {Authorization: `Bearer ${process.env.STADIUM_ACCESS_TOKEN}`} : {},
    });
    if (!response.ok || (await response.json()).service !== "naberlo") process.exit(1);
  ' >/dev/null 2>&1
}
if check_ready; then
  echo 'Naberlo hazır. Ports sekmesinde Naberlo satırındaki tarayıcı simgesini aç.'
  exit 0
fi
if [[ ! -f dist/index.html ]]; then npm run build; fi
nohup node --import tsx server/index.ts > /tmp/naberlo-codespaces.log 2>&1 < /dev/null &
stadium_pid=$!
for attempt in {1..60}; do
  if check_ready; then
    echo 'Naberlo hazır. Ports sekmesinde Naberlo satırındaki tarayıcı simgesini aç.'
    exit 0
  fi
  if ! kill -0 "$stadium_pid" 2>/dev/null; then break; fi
  sleep 0.5
done
echo 'Naberlo başlatılamadı. /tmp/naberlo-codespaces.log dosyasını kontrol et.' >&2
exit 1
