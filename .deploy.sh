#!/bin/bash
set -e
SRC="/sessions/tender-great-clarke/mnt/Claude/nonics-form-order"
cd "$(dirname "$0")"
for f in index.html logo.png package.json vercel.json firestore.rules storage.rules firebase.json; do
  [ -f "$SRC/$f" ] && cp -f "$SRC/$f" "./$f"
done
[ -d "$SRC/api" ] && cp -rf "$SRC/api" ./
git add -A
if git diff --staged --quiet; then echo "No changes to deploy"; exit 0; fi
VERSION=$(grep "APP_VERSION.*=" index.html | head -1 | grep -oE "'[^']+'" | tr -d "'")
git commit -m "deploy: $VERSION" | tail -3
git push origin main 2>&1 | tail -3
echo "✅ Deployed. Version: $VERSION"
echo "🌐 Vercel bakal auto-deploy dalam ~30 detik"
