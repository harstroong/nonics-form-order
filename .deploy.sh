#!/bin/bash
# Auto-deploy: sync files from Claude workspace → commit → push to GitHub
set -e
SRC="/sessions/tender-great-clarke/mnt/Claude/nonics-form-order"
cd "$(dirname "$0")"
cp -f "$SRC/index.html" ./index.html
cp -f "$SRC/logo.png" ./logo.png 2>/dev/null || true
cp -rf "$SRC/api" ./ 2>/dev/null || true
cp -f "$SRC/package.json" ./package.json 2>/dev/null || true
cp -f "$SRC/firestore.rules" ./firestore.rules 2>/dev/null || true
cp -f "$SRC/storage.rules" ./storage.rules 2>/dev/null || true
cp -f "$SRC/firebase.json" ./firebase.json 2>/dev/null || true
git add -A
if git diff --staged --quiet; then
  echo "No changes to deploy"
  exit 0
fi
VERSION=$(grep "APP_VERSION.*=" index.html | head -1 | grep -oE "'[^']+'" | tr -d "'")
git commit -m "deploy: $VERSION" | tail -3
git push origin main 2>&1 | tail -3
echo ""
echo "✅ Deployed. Version: $VERSION"
echo "🌐 Vercel bakal auto-deploy dalam ~30 detik"
