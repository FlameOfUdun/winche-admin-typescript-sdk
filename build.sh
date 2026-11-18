#!/usr/bin/env bash
# Builds the package from src/admin.ts: dist/index.js (one ES module) and dist/index.d.ts. Needs Deno and Node.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
deno="${DENO:-$(command -v deno || echo "$HOME/.deno/bin/deno")}"
rm -rf "$here/dist" && mkdir -p "$here/dist"
"$deno" bundle --quiet --platform browser "$here/src/admin.ts" -o "$here/dist/index.js"
tmp="$(mktemp -d)"
npx --yes -p typescript@5.8.3 tsc "$here/src/admin.ts" --declaration --emitDeclarationOnly --target ES2022 --module ESNext --moduleResolution bundler \
  --lib ES2022,DOM --skipLibCheck --outDir "$tmp"
mv "$tmp/admin.d.ts" "$here/dist/index.d.ts"
rm -rf "$tmp"
echo "built $(wc -c < "$here/dist/index.js") bytes of JS and its types in dist/"
