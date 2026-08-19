#!/bin/sh
# Regenerate js/materials-data.js from data/materials.csv.
#
# Run this after editing the CSV. No Node required: uses the JavaScriptCore shell
# that ships with macOS, same as tools/verify.sh.
set -e
cd "$(dirname "$0")/.."
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
if [ ! -x "$JSC" ]; then
  echo "JavaScriptCore shell not found at $JSC" >&2
  exit 2
fi
exec "$JSC" tools/build-materials.js
