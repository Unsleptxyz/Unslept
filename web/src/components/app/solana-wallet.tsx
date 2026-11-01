"use client";

/**
 * One wallet interface for the app: address, connect, disconnect and send. Backed by Privy (Solana wallets and email
 * login with an embedded wallet) when NEXT_PUBLIC_PRIVY_APP_ID is set, or by the browser's injected Solana wallet
 * (Phantom, Solflare, Backpack) otherwise.
 */
import { usePrivy } from "@privy-io/react-auth";
import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { ComputeBudgetProgram, Connection, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { rpcUrl } from "@/lib/solana";

export interface SolanaWallet {
  ready: boolean;
  address?: PublicKey;
  connect(): void;
  disconnect(): void;
  /** Signs with the connected wallet, sends, and waits for confirmation. Returns the signature. */
  send(ixs: TransactionInstruction[]): Promise<string>;
  connection: Connection;
}

const Ctx = createContext<SolanaWallet | undefined>(undefined);
let sharedConnection: Connection | undefined;
export const getConnection = () => (sharedConnection ??= new Connection(rpcUrl, "confirmed"));

export function useSolanaWallet(): SolanaWallet {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSolanaWallet must be used inside SolanaWalletProvider");
  return v;
}

async function buildTx(connection: Connection, payer: PublicKey, ixs: TransactionInstruction[]) {
  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 }));
  tx.add(...ixs);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;
  return { tx, blockhash, lastValidBlockHeight };
}

async function sendSigned(connection: Connection, raw: Uint8Array, blockhash: string, lastValidBlockHeight: number) {
  const sig = await connection.sendRawTransaction(raw, { preflightCommitment: "confirmed", maxRetries: 5 });
  const res = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (res.value.err) throw new Error(`Transaction failed: ${JSON.stringify(res.value.err)}`);
  return sig;
}

export function SolanaWalletProvider({ children, privy }: { children: ReactNode; privy?: boolean }) {
  return privy ? <PrivyWallet>{children}</PrivyWallet> : <InjectedWallet>{children}</InjectedWallet>;
}

function PrivyWallet({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const wallet = wallets[0];
  const address = useMemo(() => (wallet ? new PublicKey(wallet.address) : undefined), [wallet]);
  const connection = getConnection();

  const send = useCallback(
    async (ixs: TransactionInstruction[]) => {
      if (!wallet || !address) throw new Error("Connect a wallet first.");
      const { tx, blockhash, lastValidBlockHeight } = await buildTx(connection, address, ixs);
      const unsigned = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const out = (await signTransaction({ transaction: new Uint8Array(unsigned), wallet } as never)) as unknown;
      const signed = out instanceof Uint8Array ? out : (out as { signedTransaction: Uint8Array }).signedTransaction;
      return sendSigned(connection, signed, blockhash, lastValidBlockHeight);
    },
    [wallet, address, connection, signTransaction],
  );

  const value: SolanaWallet = {
    ready,
    address: authenticated || wallet ? address : undefined,
    connect: () => (authenticated ? connectWallet() : login()),
    disconnect: () => void logout(),
    send,
    connection,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

interface InjectedProvider {
  publicKey?: { toString(): string } | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signTransaction(tx: Transaction): Promise<Transaction>;
}

function injected(): InjectedProvider | undefined {
  const w = globalThis as unknown as { phantom?: { solana?: InjectedProvider }; solflare?: InjectedProvider; backpack?: InjectedProvider; solana?: InjectedProvider };
  return w.phantom?.solana ?? w.solflare ?? w.backpack ?? w.solana;
}

function InjectedWallet({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<PublicKey>();
  const [ready, setReady] = useState(false);
  const connection = getConnection();
  useEffect(() => {
    const p = injected();
    setReady(true);
    p?.connect({ onlyIfTrusted: true })
      .then((r) => setAddress(new PublicKey(r.publicKey.toString())))
      .catch(() => undefined);
  }, []);
  const value: SolanaWallet = {
    ready,
    address,
    connect: () => {
      const p = injected();
      if (!p) {
        window.open("https://phantom.com/download", "_blank", "noopener");
        return;
      }
      void p.connect().then((r) => setAddress(new PublicKey(r.publicKey.toString())));
    },
    disconnect: () => {
      void injected()?.disconnect();
      setAddress(undefined);
    },
    send: async (ixs) => {
      const p = injected();
      if (!p || !address) throw new Error("Connect a wallet first.");
      const { tx, blockhash, lastValidBlockHeight } = await buildTx(connection, address, ixs);
      const signed = await p.signTransaction(tx);
      return sendSigned(connection, signed.serialize(), blockhash, lastValidBlockHeight);
    },
    connection,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
