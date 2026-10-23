#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
node -e 'if (Number(process.versions.node.split(".")[0]) < 24) throw new Error("Node.js 24+ is required")'
export npm_config_cache="${STADIUM_NPM_CACHE:-/workspace/.npm-cache}"
npm ci --no-audit --no-fund
bash scripts/install-media-tools.sh
npm run build
npm test
