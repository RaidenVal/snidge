#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_SCRIPT="$ROOT_DIR/scripts/build-macos-sampler.sh"
HELPER_BIN="$ROOT_DIR/resources/macos/snidge-sampler"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Skipping macOS sampler helper build test on non-macOS."
  exit 0
fi

"$BUILD_SCRIPT"

if [[ ! -x "$HELPER_BIN" ]]; then
  echo "Expected executable helper at $HELPER_BIN" >&2
  exit 1
fi

file "$HELPER_BIN" | grep -q "Mach-O universal binary"

ARCHS=" $(lipo -archs "$HELPER_BIN") "
if [[ "$ARCHS" != *" arm64 "* ]]; then
  echo "Expected helper to contain arm64 slice; got:$ARCHS" >&2
  exit 1
fi

if [[ "$ARCHS" != *" x86_64 "* ]]; then
  echo "Expected helper to contain x86_64 slice; got:$ARCHS" >&2
  exit 1
fi

echo "macOS sampler helper build test passed."
