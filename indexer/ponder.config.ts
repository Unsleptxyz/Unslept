import { createConfig } from "ponder";
import { AgentAccountFactoryAbi } from "./abis/AgentAccountFactory";
import { SettlementRouterAbi } from "./abis/SettlementRouter";
import { UnsleptBufferAbi } from "./abis/UnsleptBuffer";

/** Every value comes from the environment. See ../.env.example. */
function need(k: string): string {
  const v = process.env[k]?.trim();
  if (!v) throw new Error(`${k} is required for the indexer.`);
  return v;
}

const startBlock = Number(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? 0);
const buffers = [need("NEXT_PUBLIC_BUFFER_ADDRESS"), process.env.NEXT_PUBLIC_STAKER_BUFFER_ADDRESS?.trim()].filter(
  (a): a is string => !!a,
) as `0x${string}`[];

export default createConfig({
  chains: {
    robinhood: { id: Number(need("NEXT_PUBLIC_CHAIN_ID")), rpc: need("INDEXER_RPC_URL") },
  },
  contracts: {
    SettlementRouter: {
      chain: "robinhood",
      abi: SettlementRouterAbi,
      address: need("NEXT_PUBLIC_SETTLEMENT_ROUTER_ADDRESS") as `0x${string}`,
      startBlock,
    },
    UnsleptBuffer: { chain: "robinhood", abi: UnsleptBufferAbi, address: buffers, startBlock },
    AgentAccountFactory: {
      chain: "robinhood",
      abi: AgentAccountFactoryAbi,
      address: need("NEXT_PUBLIC_AGENT_ACCOUNT_FACTORY_ADDRESS") as `0x${string}`,
      startBlock,
    },
  },
});
