#!/usr/bin/env bash
# Publishes @unslept/sdk, @unslept/mcp, then @unslept/pay. Writes a readable log to ops/npm-publish.txt (no secrets).
out="$GITHUB_WORKSPACE/ops/npm-publish.txt"
: > "$out"
if [ -z "$NODE_AUTH_TOKEN" ]; then echo "NPM_TOKEN secret is missing" >> "$out"; exit 1; fi
echo "whoami: $(npm whoami 2>&1 | tail -1)" >> "$out"
fail=0
for pkg in sdk-ts mcp pay; do
  cd "$GITHUB_WORKSPACE/packages/$pkg"
  name=$(node -p "require('./package.json').name"); ver=$(node -p "require('./package.json').version")
  echo "== $name@$ver" >> "$out"
  if npm view "$name@$ver" version >/dev/null 2>&1; then echo "already published" >> "$out"; continue; fi
  if npm publish --access public --provenance > /tmp/p.log 2>&1; then echo "published (with provenance)" >> "$out"
  else
    echo "with provenance failed:" >> "$out"; grep -iE "err|npm error" /tmp/p.log | grep -viE "token" | tail -8 >> "$out"
    if npm publish --access public > /tmp/p2.log 2>&1; then echo "published (without provenance)" >> "$out"
    else echo "publish failed:" >> "$out"; grep -iE "err|npm error" /tmp/p2.log | grep -viE "token" | tail -10 >> "$out"; fail=1; break; fi
  fi
done
cat "$out"
exit $fail
