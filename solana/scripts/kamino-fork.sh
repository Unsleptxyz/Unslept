#!/usr/bin/env bash
# Runs the Kamino yield test against real Kamino Lend: the klend program and the Main Market USDC reserve are copied
# from mainnet into a local validator, warped past the reserve's last update slot.
set -uo pipefail
cd "$(dirname "$0")/.."
RPC=${MAINNET_RPC:-https://api.mainnet-beta.solana.com}
rm -rf .fork && mkdir -p .fork
solana program dump -u "$RPC" KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD .fork/klend.so || exit 1
node scripts/fork-accounts.mjs || exit 1
source .fork/env
PROGRAM_ID=$(solana-keygen pubkey target/deploy/unslept-keypair.json)
args=(--reset --quiet --ledger .fork/ledger --warp-slot $((SLOT + 50))
  --bpf-program KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD .fork/klend.so
  --bpf-program "$PROGRAM_ID" target/deploy/unslept.so)
for f in .fork/*.json; do args+=(--account "$(basename "$f" .json)" "$f"); done
solana-test-validator "${args[@]}" > .fork/validator.log 2>&1 &
VPID=$!
for i in $(seq 1 60); do solana -u localhost cluster-version > /dev/null 2>&1 && break; sleep 1; done
export ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 ANCHOR_WALLET=$HOME/.config/solana/id.json CTOKEN_MINT SUPPLY
npx ts-mocha -p ./tsconfig.json -t 1000000 tests-fork/kamino.ts
code=$?
if [ $code -eq 0 ]; then
  echo "## SDK + @unslept/pay end to end"
  (cd ../packages/sdk-ts && npm install --no-audit --no-fund > /dev/null 2>&1)
  node --import tsx scripts/sdk-e2e.mts; code=$?
fi
kill $VPID 2>/dev/null
[ $code -ne 0 ] && grep -iE "error|panic" .fork/validator.log | tail -20
exit $code
