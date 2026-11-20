#!/usr/bin/env bash
# Final10 Cloud Agent install — idempotent dependency bootstrap.
#
# Goals:
#   - Reproducible npm installs from lockfiles
#   - Skip Puppeteer Chromium download (large, flaky, unused by unit tests)
#   - Do not require MongoDB, Stripe, eBay, or other external services
#
# Safe for Cursor Cloud Agent builds. Never prints or embeds secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[cloud-install] cwd=$ROOT"
echo "[cloud-install] node=$(node -v) npm=$(npm -v)"

# Puppeteer postinstall downloads ~170MB+ Chromium and can hang Cloud builds.
# Scraper/browser flows need Chromium separately; unit tests do not.
export PUPPETEER_SKIP_DOWNLOAD="${PUPPETEER_SKIP_DOWNLOAD:-1}"
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="${PUPPETEER_SKIP_CHROMIUM_DOWNLOAD:-1}"
echo "[cloud-install] PUPPETEER_SKIP_DOWNLOAD=$PUPPETEER_SKIP_DOWNLOAD"

# Keep npm non-interactive and quieter in CI/cloud builds.
export npm_config_fund=false
export npm_config_audit=false
export npm_config_update_notifier=false

install_lockfile_dir() {
  local dir="$1"
  local label="$2"
  local required="${3:-0}"
  if [[ ! -f "$dir/package.json" ]]; then
    echo "[cloud-install] skip $label (no package.json)"
    return 0
  fi
  echo "[cloud-install] installing $label in $dir"
  if [[ -f "$dir/package-lock.json" ]]; then
    if npm ci --prefix "$dir"; then
      return 0
    fi
    echo "[cloud-install] WARNING: npm ci failed for $label — falling back to npm install"
    if [[ "$required" == "1" ]]; then
      npm install --prefix "$dir"
      return 0
    fi
    npm install --prefix "$dir" || {
      echo "[cloud-install] WARNING: optional $label install failed; continuing"
      return 0
    }
    return 0
  fi
  echo "[cloud-install] WARNING: no package-lock.json in $dir — using npm install"
  if [[ "$required" == "1" ]]; then
    npm install --prefix "$dir"
  else
    npm install --prefix "$dir" || {
      echo "[cloud-install] WARNING: optional $label install failed; continuing"
      return 0
    }
  fi
}

# Server first — required for backend Cloud Agents and unit tests.
install_lockfile_dir "$ROOT/server" "server" 1
# Root is optional tooling (concurrently, ad-hoc scripts).
install_lockfile_dir "$ROOT" "root" 0

# Client is optional for backend-focused Cloud Agents.
if [[ "${CLOUD_INSTALL_CLIENT:-0}" == "1" ]]; then
  install_lockfile_dir "$ROOT/client" "client"
else
  echo "[cloud-install] skip client (set CLOUD_INSTALL_CLIENT=1 to include)"
fi

# packages/savvy-core is source-only for Phase 1 (no runtime npm deps required).
if [[ -f "$ROOT/packages/savvy-core/package.json" ]]; then
  echo "[cloud-install] skip savvy-core npm install (source package; no Cloud bootstrap deps)"
fi

echo "[cloud-install] verifying jest binary"
test -x "$ROOT/server/node_modules/.bin/jest"
echo "[cloud-install] complete"
