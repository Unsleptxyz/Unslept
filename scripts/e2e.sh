#!/usr/bin/env bash
# End-to-end check on a local chain: deploy the protocol, create and fund an agent,
# fund the buffer, then run the SDK against the sample x402 endpoint.
# Requires: anvil, forge, cast (Foundry) and Node 20+ with tsx.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC=http://127.0.0.1:8555
PORT=8555

# anvil's well-known development keys (local chain only)
DEPLOYER_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
MULTISIG=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
KEEPER_PK=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
KEEPER=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
OPERATOR_PK=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
OPERATOR=0x90F79bf6EB2c4f870365E785982E1f101E93b906
SIGNER_PK=0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
SIGNER=0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
MERCHANT=0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc
DEPOSITOR_PK=0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e
DEPOSITOR=0x976EA74026E726554dB657fA54763abd0C3a0aa9

anvil --silent --port $PORT &
ANVIL=$!
trap 'kill $ANVIL' EXIT
sleep 1.5

cd "$ROOT/contracts"
DEPLOYER_PRIVATE_KEY=$DEPLOYER_PK PAUSER_MULTISIG_ADDRESS=$MULTISIG KEEPER_ADDRESS=$KEEPER \
TIMELOCK_DELAY_SECONDS=60 SETTLEMENT_FEE_BPS=10 BUFFER_DEPOSIT_CAP=1000000000000 \
WITHDRAW_QUEUE_THRESHOLD_BPS=8000 BUFFER_TARGET_BPS=2000 ASSET_CAP=500000000000 \
  forge script script/Deploy.s.sol --tc Deploy --rpc-url $RPC --broadcast >/dev/null
DEP="$ROOT/contracts/deployments/31337.json"
j() { python3 -c "import json;print(json.load(open('$DEP'))['$1'])"; }
USDG=$(j usdg); FACTORY=$(j agentAccountFactory); BUFFER=$(j buffer); ROUTER=$(j settlementRouter)
ALLOCATOR=$(j allocator); ADAPTER=$(j adapter)

send() { cast send "$@" --rpc-url $RPC >/dev/null; }

# Depositor funds the buffer
send $USDG "mint(address,uint256)" $DEPOSITOR 100000000000 --private-key $DEPLOYER_PK
send $USDG "approve(address,uint256)" $BUFFER 100000000000 --private-key $DEPOSITOR_PK
send $BUFFER "deposit(uint256,address)" 100000000000 $DEPOSITOR --private-key $DEPOSITOR_PK

# Operator creates an agent: 1 USDG per call, 10 USDG a day, merchant allowlisted
send $FACTORY "createAccount(address,(uint128,uint128),bytes32)" $SIGNER "(1000000,10000000)" 0x0000000000000000000000000000000000000000000000000000000000000001 --private-key $OPERATOR_PK
AGENT=$(cast call $FACTORY "accountsOf(address)(address[])" $OPERATOR --rpc-url $RPC | tr -d '[]')
send $AGENT "setPayee(address,bool)" $MERCHANT true --private-key $OPERATOR_PK

# Fund the agent and park everything: the payment comes from the buffer, not from idle cash
send $USDG "mint(address,uint256)" $AGENT 50000000 --private-key $DEPLOYER_PK
send $ALLOCATOR "allocateAgent(address,address,uint256)" $AGENT $ADAPTER 50000000 --private-key $KEEPER_PK

cd "$ROOT/packages/sdk-ts"
E2E_RPC=$RPC E2E_CHAIN_ID=31337 E2E_USDG=$USDG E2E_ROUTER=$ROUTER E2E_BUFFER=$BUFFER E2E_AGENT=$AGENT \
E2E_SIGNER_KEY=$SIGNER_PK E2E_MERCHANT=$MERCHANT \
  node --import "${TSX_IMPORT:-tsx}" --test test/e2e.test.ts

E2E_RPC=$RPC E2E_BUFFER=$BUFFER E2E_ROUTER=$ROUTER E2E_FACTORY=$FACTORY E2E_TIMELOCK=$(j timelock) E2E_ADAPTER=$ADAPTER E2E_AGENT=$AGENT \
  node --import "${TSX_IMPORT:-tsx}" --test "$ROOT/monitor/test/monitor.e2e.test.ts"

echo "Agent debt after payment (repaid in the background by the allocator):"
cast call $BUFFER "debtOf(address)(uint256)" $AGENT --rpc-url $RPC
send $USDG "mint(address,uint256)" $AGENT 3000000 --private-key $DEPLOYER_PK   # idle cash for the keeper to park
KEEPER_RPC_URL=$RPC KEEPER_PRIVATE_KEY=$KEEPER_PK NEXT_PUBLIC_AGENT_ACCOUNT_FACTORY_ADDRESS=$FACTORY \
NEXT_PUBLIC_ALLOCATOR_ADDRESS=$ALLOCATOR NEXT_PUBLIC_BUFFER_ADDRESS=$BUFFER KEEPER_ADAPTER=$ADAPTER \
  bash "$ROOT/ops/keeper.sh"
echo "Agent liquid after keeper (parked):"
cast call $AGENT "liquid()(uint256)" --rpc-url $RPC
echo "Agent debt after keeper:"
cast call $BUFFER "debtOf(address)(uint256)" $AGENT --rpc-url $RPC
