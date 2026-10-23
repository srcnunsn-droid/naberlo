#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
export HOST=127.0.0.1
export PORT="${PORT:-3001}"
if [[ -n "${CODESPACE_NAME:-}" && -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
  export STADIUM_PUBLIC_ORIGIN="https://${CODESPACE_NAME}-${PORT}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
fi
if [[ "${1:-}" == '--restart' ]]; then
  node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
const root = fs.realpathSync(process.cwd());
const stopped = [];
for (const entry of fs.readdirSync('/proc')) {
  if (!/^\d+$/.test(entry) || Number(entry) === process.pid) continue;
  try {
    if (fs.realpathSync(`/proc/${entry}/cwd`) !== root) continue;
    const args = fs.readFileSync(`/proc/${entry}/cmdline`, 'utf8').split('\0').filter(Boolean);
    if (path.basename(args[0] || '') !== 'node' || args[1] !== '--import' || args[2] !== 'tsx' || args[3] !== 'server/index.ts') continue;
    const vars = fs.readFileSync(`/proc/${entry}/environ`, 'utf8').split('\0');
    if (!vars.includes(`PORT=${process.env.PORT}`)) continue;
    process.kill(Number(entry), 'SIGTERM');
    stopped.push(Number(entry));
  } catch (e) { if (!['ENOENT', 'ESRCH', 'EACCES'].includes(e.code)) throw e; }
}
for (let i = 0; i < 50; i++) {
  if (stopped.every(pid => { try { return fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].startsWith('Z'); } catch { return true; } })) process.exit(0);
  await new Promise(resolve => setTimeout(resolve, 100));
}
throw new Error('Önceki Naberlo işlemi kapanmadı; zorla kapatılmadı.');
NODE
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
