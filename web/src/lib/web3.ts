import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { defineChain, type Abi } from "viem";
import agentAccountAbi from "@/abi/AgentAccount.json";
import factoryAbi from "@/abi/AgentAccountFactory.json";
import bufferAbi from "@/abi/UnsleptBuffer.json";
import routerAbi from "@/abi/SettlementRouter.json";
import allocatorAbi from "@/abi/Allocator.json";

/**
 * Chain and contract configuration, read from public environment variables.
 * Nothing falls back to a guessed value: when something is missing the app shows a "not configured" screen.
 */

const env = {
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
  chainName: process.env.NEXT_PUBLIC_CHAIN_NAME || "Robinhood Chain",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL,
  usdg: process.env.NEXT_PUBLIC_USDG_ADDRESS,
  factory: process.env.NEXT_PUBLIC_AGENT_ACCOUNT_FACTORY_ADDRESS,
  buffer: process.env.NEXT_PUBLIC_BUFFER_ADDRESS,
  stakerBuffer: process.env.NEXT_PUBLIC_STAKER_BUFFER_ADDRESS,
  router: process.env.NEXT_PUBLIC_SETTLEMENT_ROUTER_ADDRESS,
  allocator: process.env.NEXT_PUBLIC_ALLOCATOR_ADDRESS,
  deployBlock: process.env.NEXT_PUBLIC_DEPLOY_BLOCK,
};

const isAddr = (v?: string): v is `0x${string}` => !!v && /^0x[0-9a-fA-F]{40}$/.test(v);

export const missingConfig: string[] = [
  ["NEXT_PUBLIC_CHAIN_ID", env.chainId && /^\d+$/.test(env.chainId)],
  ["NEXT_PUBLIC_RPC_URL", env.rpcUrl],
  ["NEXT_PUBLIC_USDG_ADDRESS", isAddr(env.usdg)],
  ["NEXT_PUBLIC_AGENT_ACCOUNT_FACTORY_ADDRESS", isAddr(env.factory)],
  ["NEXT_PUBLIC_BUFFER_ADDRESS", isAddr(env.buffer)],
  ["NEXT_PUBLIC_SETTLEMENT_ROUTER_ADDRESS", isAddr(env.router)],
  ["NEXT_PUBLIC_ALLOCATOR_ADDRESS", isAddr(env.allocator)],
]
  .filter(([, ok]) => !ok)
  .map(([k]) => k as string);

export const isConfigured = missingConfig.length === 0;

export const chain = isConfigured
  ? defineChain({
      id: Number(env.chainId),
      name: env.chainName,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [env.rpcUrl!] } },
      ...(env.explorerUrl ? { blockExplorers: { default: { name: "Explorer", url: env.explorerUrl } } } : {}),
    })
  : undefined;

export const addresses = {
  usdg: env.usdg as `0x${string}`,
  factory: env.factory as `0x${string}`,
  buffer: env.buffer as `0x${string}`,
  stakerBuffer: isAddr(env.stakerBuffer) ? env.stakerBuffer : undefined,
  router: env.router as `0x${string}`,
  allocator: env.allocator as `0x${string}`,
};

export const deployBlock = env.deployBlock ? BigInt(env.deployBlock) : 0n;

export const abis = {
  agentAccount: agentAccountAbi as Abi,
  factory: factoryAbi as Abi,
  buffer: bufferAbi as Abi,
  router: routerAbi as Abi,
  allocator: allocatorAbi as Abi,
  erc20: [
    { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
    { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
  ] as const satisfies Abi,
};

/** Privy app ID (public). When set, wallets connect through Privy; otherwise through the injected browser wallet. */
export const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || undefined;

export const rpcUrl = env.rpcUrl;

/** Plain wagmi config with the injected browser wallet. Used when Privy is not configured. */
export const wagmiConfig = chain
  ? createConfig({
      chains: [chain],
      connectors: [injected()],
      transports: { [chain.id]: http(env.rpcUrl) },
      ssr: true,
    })
  : undefined;

export function txUrl(hash: string): string | undefined {
  return env.explorerUrl ? `${env.explorerUrl.replace(/\/$/, "")}/tx/${hash}` : undefined;
}

export function addressUrl(a: string): string | undefined {
  return env.explorerUrl ? `${env.explorerUrl.replace(/\/$/, "")}/address/${a}` : undefined;
}
