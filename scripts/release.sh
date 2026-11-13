#!/bin/bash
# Builds a signed universal macOS release into dist-release/. With --publish it also creates the GitHub
# release, which is what the installer and the in-app updater both read.
#
#   scripts/release.sh            build and sign only
#   scripts/release.sh --publish  build, sign, and publish v<version> to GitHub
#
# Needs the updater signing key at ~/.tauri/crooli-mail-updater.key (override with CROOLI_UPDATER_KEY).
# Never commit that key: losing it means existing installs can't be updated.
set -euo pipefail
cd "$(dirname "$0")/.."

REPO="xandertaylorx/crooli-mail"
KEY="${CROOLI_UPDATER_KEY:-$HOME/.tauri/crooli-mail-updater.key}"
[ -f "$KEY" ] || { echo "Missing signing key: $KEY"; exit 1; }

VERSION=$(python3 -c "import json;print(json.load(open('src-tauri/tauri.conf.json'))['version'])")
echo "→ Building Crooli Mail $VERSION"

export TAURI_SIGNING_PRIVATE_KEY="$KEY"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
pnpm tauri build --target universal-apple-darwin --bundles app

B="src-tauri/target/universal-apple-darwin/release/bundle/macos"
OUT="dist-release"
mkdir -p "$OUT"
rm -f "$OUT"/CrooliMail-"$VERSION"-* "$OUT/latest.json"

APP="$B/Crooli Mail.app"
codesign --verify --deep --strict "$APP"

# 1. The zip the curl installer downloads
ditto -c -k --keepParent "$APP" "$OUT/CrooliMail-$VERSION-mac-universal.zip"

# 2. The signed archive the in-app updater downloads
TAR=$(ls "$B"/*.app.tar.gz | head -n1)
SIG=$(ls "$B"/*.app.tar.gz.sig | head -n1)
cp "$TAR" "$OUT/CrooliMail-$VERSION-mac-universal.app.tar.gz"
cp "$SIG" "$OUT/CrooliMail-$VERSION-mac-universal.app.tar.gz.sig"

# 3. latest.json: one universal build serves both Mac architectures
URL="https://github.com/$REPO/releases/download/v$VERSION/CrooliMail-$VERSION-mac-universal.app.tar.gz"
python3 - "$VERSION" "$URL" "$OUT" <<'PY'
import json, sys, datetime
version, url, out = sys.argv[1:4]
sig = open(f"{out}/CrooliMail-{version}-mac-universal.app.tar.gz.sig").read().strip()
entry = {"signature": sig, "url": url}
json.dump({
    "version": version,
    "notes": open("RELEASE_NOTES.md").read().strip() if __import__("os").path.exists("RELEASE_NOTES.md") else "",
    "pub_date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "platforms": {"darwin-aarch64": entry, "darwin-x86_64": entry, "darwin-aarch64-app": entry, "darwin-x86_64-app": entry},
}, open(f"{out}/latest.json", "w"), indent=2)
PY
ls -la "$OUT" | grep -E "$VERSION|latest"

if [ "${1:-}" = "--publish" ]; then
  echo "→ Publishing v$VERSION to $REPO"
  NOTES_ARG=(--generate-notes)
  [ -f RELEASE_NOTES.md ] && NOTES_ARG=(--notes-file RELEASE_NOTES.md)
  gh release create "v$VERSION" "$OUT"/CrooliMail-"$VERSION"-* "$OUT/latest.json" --repo "$REPO" --title "Crooli Mail $VERSION" "${NOTES_ARG[@]}"
  echo "✓ Published. Installed copies will offer the update on their next check."
else
  echo "Built only. Run with --publish to release."
fi
