"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { abis, addresses, deployBlock } from "@/lib/web3";

export interface AccountInfo {
  address: `0x${string}`;
  signer: `0x${string}`;
  isTreasury: boolean;
  perCallCap: bigint;
  dailyCap: bigint;
  remainingToday: bigint;
  paused: boolean;
  revoked: boolean;
  autoAllocate: boolean;
  liquid: bigint;
  parked: bigint;
  debt: bigint;
  positions: `0x${string}`[];
}

export function useMyAccounts() {
  const { address } = useAccount();
  const list = useReadContract({
    address: addresses.factory,
    abi: abis.factory,
    functionName: "accountsOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const accounts = (list.data as `0x${string}`[] | undefined) ?? [];
  const fields = ["agentSigner", "policy", "remainingToday", "paused", "revoked", "autoAllocate", "liquid", "parkedValue", "totalDebt", "positions"] as const;
  const reads = useReadContracts({
    contracts: accounts.flatMap((a) => fields.map((f) => ({ address: a, abi: abis.agentAccount, functionName: f }))),
    query: { enabled: accounts.length > 0 },
  });
  const infos: AccountInfo[] = accounts.map((a, i) => {
    const r = (k: number) => reads.data?.[i * fields.length + k]?.result as unknown;
    const policy = (r(1) as readonly [bigint, bigint] | undefined) ?? [0n, 0n];
    const signer = (r(0) as `0x${string}`) ?? "0x0000000000000000000000000000000000000000";
    return {
      address: a,
      signer,
      isTreasury: /^0x0{40}$/i.test(signer) && !(r(4) as boolean),
      perCallCap: policy[0],
      dailyCap: policy[1],
      remainingToday: (r(2) as bigint) ?? 0n,
      paused: (r(3) as boolean) ?? false,
      revoked: (r(4) as boolean) ?? false,
      autoAllocate: (r(5) as boolean) ?? false,
      liquid: (r(6) as bigint) ?? 0n,
      parked: (r(7) as bigint) ?? 0n,
      debt: (r(8) as bigint) ?? 0n,
      positions: (r(9) as `0x${string}`[]) ?? [],
    };
  });
  return {
    accounts: infos,
    isLoading: list.isLoading || reads.isLoading,
    refetch: () => {
      void list.refetch();
      void reads.refetch();
    },
  };
}

export interface PaymentRow {
  paymentId: `0x${string}`;
  agent: `0x${string}`;
  payee: `0x${string}`;
  amount: bigint;
  fee: bigint;
  endpoint: string;
  txHash: `0x${string}`;
  blockNumber: bigint;
  timestamp?: number;
}

/** Settled events for the given agents, newest first, with block timestamps. */
export function usePayments(agents: `0x${string}`[], limit = 50) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["payments", agents.join(","), limit],
    enabled: !!client && agents.length > 0,
    queryFn: async (): Promise<PaymentRow[]> => {
      const logs = (await client!.getContractEvents({
        address: addresses.router,
        abi: abis.router,
        eventName: "Settled",
        args: { agent: agents },
        fromBlock: deployBlock,
      } as never)) as unknown as {
        args: { paymentId: `0x${string}`; agent: `0x${string}`; payee: `0x${string}`; amount: bigint; fee: bigint; endpoint: string };
        transactionHash: `0x${string}`;
        blockNumber: bigint;
      }[];
      const rows = logs
        .map((l) => ({ ...l.args, txHash: l.transactionHash, blockNumber: l.blockNumber }))
        .reverse()
        .slice(0, limit);
      const blocks = [...new Set(rows.map((r) => r.blockNumber))];
      const times = new Map<bigint, number>();
      await Promise.all(
        blocks.map(async (b) => {
          const blk = await client!.getBlock({ blockNumber: b });
          times.set(b, Number(blk.timestamp));
        }),
      );
      return rows.map((r) => ({ ...r, timestamp: times.get(r.blockNumber) }));
    },
  });
}

export function useBuffer(buffer: `0x${string}` = addresses.buffer) {
  const { address } = useAccount();
  const user = address ?? "0x0000000000000000000000000000000000000000";
  const fns = [
    ["totalAssets", []],
    ["available", []],
    ["utilizationBps", []],
    ["queueThresholdBps", []],
    ["depositCap", []],
    ["balanceOf", [user]],
    ["maxWithdraw", [user]],
    ["paused", []],
  ] as const;
  const reads = useReadContracts({
    contracts: fns.map(([f, args]) => ({ address: buffer, abi: abis.buffer, functionName: f, args })),
  });
  const shares = (reads.data?.[5]?.result as bigint) ?? 0n;
  const value = useReadContract({
    address: buffer,
    abi: abis.buffer,
    functionName: "convertToAssets",
    args: [shares],
    query: { enabled: shares > 0n },
  });
  const usdgBal = useReadContract({
    address: addresses.usdg,
    abi: abis.erc20,
    functionName: "balanceOf",
    args: [user],
    query: { enabled: !!address },
  });
  const allowance = useReadContract({
    address: addresses.usdg,
    abi: abis.erc20,
    functionName: "allowance",
    args: [user, buffer],
    query: { enabled: !!address },
  });
  const r = (i: number) => reads.data?.[i]?.result as unknown;
  return {
    totalAssets: r(0) as bigint | undefined,
    available: r(1) as bigint | undefined,
    utilizationBps: r(2) as bigint | undefined,
    queueThresholdBps: r(3) as number | undefined,
    depositCap: r(4) as bigint | undefined,
    shares,
    position: shares > 0n ? (value.data as bigint | undefined) : 0n,
    maxWithdraw: r(6) as bigint | undefined,
    paused: r(7) as boolean | undefined,
    walletUsdg: usdgBal.data as bigint | undefined,
    allowance: allowance.data as bigint | undefined,
    isLoading: reads.isLoading,
    refetch: () => {
      void reads.refetch();
      void value.refetch();
      void usdgBal.refetch();
      void allowance.refetch();
    },
  };
}

export interface TicketRow {
  id: bigint;
  assets: bigint;
  funded: boolean;
  claimed: boolean;
}

/** The connected wallet's withdrawal tickets and its deposit/withdraw history, from buffer events. */
export function useBufferHistory(buffer: `0x${string}` = addresses.buffer) {
  const client = usePublicClient();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["buffer-history", buffer, address],
    enabled: !!client && !!address,
    queryFn: async () => {
      const ev = (eventName: string, args: Record<string, unknown>) =>
        client!.getContractEvents({ address: buffer, abi: abis.buffer, eventName, args, fromBlock: deployBlock } as never) as unknown as Promise<
          { args: Record<string, bigint>; transactionHash: `0x${string}`; blockNumber: bigint }[]
        >;
      const [deposits, withdraws, requested] = await Promise.all([
        ev("Deposit", { owner: address }),
        ev("Withdraw", { owner: address }),
        ev("WithdrawRequested", { owner: address }),
      ]);
      const tickets: TicketRow[] = await Promise.all(
        requested.map(async (l) => {
          const t = (await client!.readContract({ address: buffer, abi: abis.buffer, functionName: "ticket", args: [l.args.ticket] })) as {
            assets: bigint;
            funded: boolean;
            claimed: boolean;
          };
          return { id: l.args.ticket, assets: t.assets, funded: t.funded, claimed: t.claimed };
        }),
      );
      const deposited = deposits.reduce((s, l) => s + l.args.assets, 0n);
      const withdrawn = withdraws.reduce((s, l) => s + l.args.assets, 0n) + tickets.reduce((s, t) => s + t.assets, 0n);
      const events = [
        ...deposits.map((l) => ({ kind: "Deposit" as const, assets: l.args.assets, txHash: l.transactionHash, blockNumber: l.blockNumber })),
        ...withdraws.map((l) => ({ kind: "Withdrawal" as const, assets: l.args.assets, txHash: l.transactionHash, blockNumber: l.blockNumber })),
        ...requested.map((l) => ({ kind: "Queued withdrawal" as const, assets: l.args.assets, txHash: l.transactionHash, blockNumber: l.blockNumber })),
      ].sort((a, b) => Number(b.blockNumber - a.blockNumber));
      return { tickets, deposited, withdrawn, events };
    },
  });
}
