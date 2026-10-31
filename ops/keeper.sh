#!/usr/bin/env bash
# Unslept keeper: one pass. Run from cron (for example every minute).
#  - repays buffer debt from parked positions (Allocator.settleDebt, permissionless)
#  - parks idle agent cash above KEEPER_MIN_PARK_USDG (Allocator.allocateAgent, KEEPER_ROLE)
#  - refills the buffer from its own position when it is below target (Allocator.refillBuffer, permissionless)
# Requires Foundry's cast. Reads every address from the environment; nothing is assumed.
set -euo pipefail
: "${KEEPER_RPC_URL:?}" "${KEEPER_PRIVATE_KEY:?}" "${NEXT_PUBLIC_AGENT_ACCOUNT_FACTORY_ADDRESS:?}"
: "${NEXT_PUBLIC_ALLOCATOR_ADDRESS:?}" "${NEXT_PUBLIC_BUFFER_ADDRESS:?}" "${KEEPER_ADAPTER:?}"
FROM_BLOCK="${NEXT_PUBLIC_DEPLOY_BLOCK:-0}"
MIN_PARK="${KEEPER_MIN_PARK_USDG:-1000000}"   # atomic units; default 1 USDG
RPC=$KEEPER_RPC_URL
ALLOC=$NEXT_PUBLIC_ALLOCATOR_ADDRESS

send() { cast send "$@" --rpc-url "$RPC" --private-key "$KEEPER_PRIVATE_KEY" >/dev/null 2>&1 && echo "ok   $*" || echo "skip $* (reverted)"; }
num() { cast call "$@" --rpc-url "$RPC" | awk '{print $1}'; }

accounts=$(cast logs --rpc-url "$RPC" --from-block "$FROM_BLOCK" --address "$NEXT_PUBLIC_AGENT_ACCOUNT_FACTORY_ADDRESS" \
  "AccountCreated(address indexed,address indexed,address indexed,bool)" --json | python3 -c '
import json,sys
for l in json.load(sys.stdin): print("0x"+l["topics"][1][26:])')

for a in $accounts; do
  debt=$(num "$a" "totalDebt()(uint256)")
  if [ "$debt" != "0" ]; then send "$ALLOC" "settleDebt(address)" "$a"; fi
  liquid=$(num "$a" "liquid()(uint256)")
  auto=$(cast call "$a" "autoAllocate()(bool)" --rpc-url "$RPC")
  if [ "$auto" = "true" ] && [ "$(python3 -c "print(int($liquid) > int($MIN_PARK))")" = "True" ]; then
    send "$ALLOC" "allocateAgent(address,address,uint256)" "$a" "$KEEPER_ADAPTER" "$liquid"
  fi
done

send "$ALLOC" "refillBuffer(address,address)" "$NEXT_PUBLIC_BUFFER_ADDRESS" "$KEEPER_ADAPTER"
send "$NEXT_PUBLIC_BUFFER_ADDRESS" "processQueue(uint256)" 50
