#!/usr/bin/env bash
# Verifies the local prerequisites documented in docs/10-devops/local-development.md
# are present before a developer runs `pnpm install`. Exits non-zero with a
# clear message on the first missing prerequisite.
set -euo pipefail

fail() {
  echo "✗ $1" >&2
  exit 1
}

ok() {
  echo "✓ $1"
}

command -v node >/dev/null 2>&1 || fail "Node.js is not installed. See .nvmrc for the required version."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || fail "Node.js 20+ is required (found $(node --version))."
ok "Node.js $(node --version)"

command -v pnpm >/dev/null 2>&1 || fail "pnpm is not installed. See docs/11-adr/ADR-001-monorepo.md."
ok "pnpm $(pnpm --version)"

command -v docker >/dev/null 2>&1 || fail "Docker is not installed — required for local Supabase (supabase start)."
ok "Docker present"

if ! docker info >/dev/null 2>&1; then
  fail "Docker is installed but the daemon is not running (or not reachable in this environment)."
fi
ok "Docker daemon reachable"

if [ ! -f .env.local ]; then
  echo "! .env.local not found — copy .env.example to .env.local and fill in local Supabase values." >&2
fi

echo "All checked prerequisites are satisfied."
