#!/bin/sh
# Headless verification run. No Node required: uses the JavaScriptCore shell that
# ships with macOS. Open verify.html in a browser for the same suite as a page.
set -e
cd "$(dirname "$0")/.."
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
if [ ! -x "$JSC" ]; then
  echo "JavaScriptCore shell not found at $JSC" >&2
  echo "Open verify.html in a browser instead." >&2
  exit 2
fi
exec "$JSC" tools/run-verify.js
