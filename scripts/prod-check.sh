#!/bin/bash
# Pre-deployment check — runs everything Vercel will run
# Fails fast if the build would break on Vercel

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  PRODUCTION DEPLOYMENT PRE-CHECK"
echo "═══════════════════════════════════════════════════════════"

cd "$(dirname "$0")/.."

echo ""
echo "▶ 1/5 — Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "   Node: $NODE_VERSION"

echo ""
echo "▶ 2/5 — Checking package.json for Node engines..."
if ! grep -q '"node":' package.json; then
  echo "   ❌ Missing 'engines.node' in package.json"
  exit 1
fi
echo "   ✅ engines.node set"

echo ""
echo "▶ 3/5 — Verifying .npmrc has legacy-peer-deps..."
if ! grep -q "legacy-peer-deps=true" .npmrc 2>/dev/null; then
  echo "   ❌ .npmrc missing legacy-peer-deps=true"
  exit 1
fi
echo "   ✅ legacy-peer-deps enabled"

echo ""
echo "▶ 4/5 — Type check..."
npx tsc --noEmit
echo "   ✅ TypeScript compiles cleanly"

echo ""
echo "▶ 5/5 — Full production build (simulating Vercel)..."
DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
NEXTAUTH_SECRET="dummy" \
NEXTAUTH_URL="https://dmshiyam.com" \
npm run build

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ ALL CHECKS PASSED — SAFE TO DEPLOY"
echo "═══════════════════════════════════════════════════════════"
