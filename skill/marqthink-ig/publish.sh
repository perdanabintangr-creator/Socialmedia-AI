#!/usr/bin/env bash
# Unggah aset ke branch marqthink-media dan cetak URL jsDelivr (dikunci per commit).
# Pakai: bash publish.sh "<pesan commit>" file1.jpg file2.jpg ...
# Output: satu URL per baris, urutan sama dengan argumen.
set -euo pipefail
MSG="$1"; shift
FILES=(); for f in "$@"; do FILES+=("$(realpath "$f")"); done
WORK="${MQ_MEDIA_DIR:-$(mktemp -d)/media}"
if [ ! -d "$WORK/.git" ]; then
  git clone -q --depth 1 -b marqthink-media https://github.com/perdanabintangr-creator/Socialmedia-AI.git "$WORK"
fi
cd "$WORK"
git pull -q --rebase origin marqthink-media || true
NAMES=()
for f in "${FILES[@]}"; do
  n="$(basename "$f")"
  if [ -e "$n" ] && ! cmp -s "$f" "$n"; then echo "FAIL: $n sudah ada dengan isi berbeda; ganti nama" >&2; exit 1; fi
  cp "$f" "$n"; NAMES+=("$n")
done
git add -- "${NAMES[@]}"
git -c user.name=Claude -c user.email=noreply@anthropic.com commit -q -m "$MSG" || true
git push -q origin HEAD:marqthink-media
SHA="$(git rev-parse HEAD)"
for n in "${NAMES[@]}"; do
  echo "https://cdn.jsdelivr.net/gh/perdanabintangr-creator/Socialmedia-AI@${SHA}/${n}"
done
