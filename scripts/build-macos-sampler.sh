#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT_DIR/native/macos-sampler/SnidgeSampler.m"
OUT_DIR="$ROOT_DIR/resources/macos"
OUT="$OUT_DIR/snidge-sampler"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS sampler helper can only be built on macOS." >&2
  exit 1
fi

SDKROOT="$(xcrun --show-sdk-path)"
CLANG="$(xcrun --find clang)"
mkdir -p "$OUT_DIR"

"$CLANG" \
  -fobjc-arc \
  -Wall \
  -Wextra \
  -Werror \
  -mmacosx-version-min=10.15 \
  -arch arm64 \
  -arch x86_64 \
  -isysroot "$SDKROOT" \
  "$SRC" \
  -framework AppKit \
  -o "$OUT"

echo "Built $OUT"
