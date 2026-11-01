"use client";

import { useQuery } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import {
  PROGRAM_ID,
  USDC_MINT,
  addresses,
  agentCtoken,
  agentVault,
  ata,
  decodeAgent,
  decodeConfig,
  decodeSettled,
  type AgentState,
} from "@/lib/solana";
import { getConnection, useSolanaWallet } from "./solana-wallet";

async function tokenBalance(a: PublicKey): Promise<bigint> {
  const r = await getConnection().getTokenAccountBalance(a, "confirmed").catch(() => undefined);
  return r ? BigInt(r.value.amount) : 0n;
}

export interface AgentInfo extends AgentState {
  /** USDC in the agent vault. */
  liquid: bigint;
  /** cUSDC held in Kamino. */
  ctokens: bigint;
}

/** Agent accounts owned by the connected wallet. */
export function useMyAgents() {
  const { address } = useSolanaWallet();
  const q = useQuery({
    queryKey: ["agents", address?.toBase58()],
    enabled: !!address,
    queryFn: async (): Promise<AgentInfo[]> => {
      const conn = getConnection();
      const accts = await conn.getProgramAccounts(PROGRAM_ID, {
        commitment: "confirmed",
        filters: [{ memcmp: { offset: 0, bytes: "8yGSUtV5BEn" } }, { memcmp: { offset: 8, bytes: address!.toBase58() } }],
      });
      const agents = accts
        .map((a) => decodeAgent(a.pubkey, new Uint8Array(a.account.data)))
        .filter((a): a is AgentState => !!a)
        .sort((a, b) => Number(a.agentId - b.agentId));
      return Promise.all(
        agents.map(async (a) => ({ ...a, liquid: await tokenBalance(agentVault(a.address)), ctokens: await tokenBalance(agentCtoken(a.address)) })),
      );
    },
  });
  return { agents: q.data ?? [], isLoading: q.isLoading, refetch: () => void q.refetch() };
}

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const info = await getConnection().getAccountInfo(addresses.config, "confirmed");
      return info ? decodeConfig(new Uint8Array(info.data)) : undefined;
    },
  });
}

export interface PaymentRow {
  paymentId: string;
  agent: string;
  payee: string;
  amount: bigint;
  fee: bigint;
  signature: string;
  timestamp?: number;
}

/** Settled events for the given agents, newest first. */
export function usePayments(agents: PublicKey[], limit = 25) {
  return useQuery({
    queryKey: ["payments", agents.map((a) => a.toBase58()).join(","), limit],
    enabled: agents.length > 0,
    queryFn: async (): Promise<PaymentRow[]> => {
      const conn = getConnection();
      const rows: PaymentRow[] = [];
      for (const agent of agents) {
        const sigs = await conn.getSignaturesForAddress(agent, { limit }, "confirmed");
        const txs = await Promise.all(
          sigs.filter((s) => !s.err).map((s) => conn.getTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }).then((t) => ({ s, t }))),
        );
        for (const { s, t } of txs) {
          for (const line of t?.meta?.logMessages ?? []) {
            if (!line.startsWith("Program data: ")) continue;
            const ev = decodeSettled(line.slice(14));
            if (ev && ev.agent === agent.toBase58()) rows.push({ ...ev, signature: s.signature, timestamp: s.blockTime ?? undefined });
          }
        }
      }
      return rows.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)).slice(0, limit);
    },
  });
}

/** Buffer totals and the connected wallet's position. */
export function useBuffer() {
  const { address } = useSolanaWallet();
  const q = useQuery({
    queryKey: ["buffer", address?.toBase58()],
    queryFn: async () => {
      const conn = getConnection();
      const [cfgInfo, supply] = await Promise.all([
        conn.getAccountInfo(addresses.config, "confirmed"),
        conn.getTokenSupply(addresses.shareMint, "confirmed").catch(() => undefined),
      ]);
      const config = cfgInfo ? decodeConfig(new Uint8Array(cfgInfo.data)) : undefined;
      const available = await tokenBalance(addresses.bufferVault);
      const totalShares = supply ? BigInt(supply.value.amount) : 0n;
      const totalAssets = available + (config?.outstandingDebt ?? 0n);
      const shares = address ? await tokenBalance(ata(address, addresses.shareMint)) : 0n;
      const walletUsdc = address ? await tokenBalance(ata(address, USDC_MINT)) : 0n;
      const position = totalShares > 0n ? (shares * totalAssets) / totalShares : 0n;
      const maxWithdraw = position < available ? position : available;
      return {
        config,
        totalAssets,
        available,
        utilizationBps: totalAssets > 0n ? ((config?.outstandingDebt ?? 0n) * 10_000n) / totalAssets : 0n,
        depositCap: config?.depositCap,
        paused: config?.paused,
        totalShares,
        shares,
        position,
        maxWithdraw,
        walletUsdc,
      };
    },
  });
  return { ...q.data, isLoading: q.isLoading, refetch: () => void q.refetch() };
}

/** Converts a USDC amount to buffer shares at the current price (rounded down). */
export function sharesFor(assets: bigint, totalAssets: bigint, totalShares: bigint) {
  return totalShares === 0n || totalAssets === 0n ? assets : (assets * totalShares) / totalAssets;
}
