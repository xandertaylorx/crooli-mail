#!/bin/bash
# Installs the latest Crooli Mail into /Applications.
# Files fetched with curl aren't flagged by macOS as "downloaded from the internet",
# so there's no Gatekeeper warning to click through.
#
#   curl -fsSL https://mail.crooli.com/install.sh | bash
set -euo pipefail

REPO="xandertaylorx/crooli-mail"
APP="Crooli Mail.app"

[ "$(uname -s)" = "Darwin" ] || { echo "Crooli Mail's installer is for macOS. Windows is coming later."; exit 1; }

major=$(sw_vers -productVersion | cut -d. -f1)
[ "$major" -ge 13 ] || { echo "Crooli Mail needs macOS 13 or later."; exit 1; }

echo "→ Finding the latest Crooli Mail"
url=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep -o 'https://[^"]*mac-universal\.zip' | head -n1)
[ -n "$url" ] || { echo "Couldn't find a Crooli Mail release to download."; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
echo "→ Downloading ${url##*/}"
curl -fL --progress-bar "$url" -o "$tmp/crooli-mail.zip"
ditto -x -k "$tmp/crooli-mail.zip" "$tmp"

echo "→ Installing into /Applications"
pkill -x "Crooli Mail" 2>/dev/null || true
rm -rf "/Applications/$APP"
mv "$tmp/$APP" "/Applications/$APP"
xattr -cr "/Applications/$APP" 2>/dev/null || true

echo "✓ Installed. Opening Crooli Mail…"
open "/Applications/$APP"
