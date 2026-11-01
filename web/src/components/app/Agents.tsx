"use client";

import { useQuery } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { useMemo, useState } from "react";
import { fmtUsdc, parseUsdc, shortAddr } from "@/lib/format";
import { USDC_MINT, addressUrl, agentAddress, ata, build } from "@/lib/solana";
import { EligibilityGate } from "./Eligibility";
import { getConnection, useSolanaWallet } from "./solana-wallet";
import { useConfig, useMyAgents, usePayments, type AgentInfo } from "./hooks";
import { PaymentTable } from "./Overview";
import { TxButton, TxPreview } from "./Tx";

const toKey = (s: string) => {
  try {
    const k = new PublicKey(s);
    return PublicKey.isOnCurve(k.toBytes()) ? k : undefined;
  } catch {
    return undefined;
  }
};

const toAddr = (s: string) => {
  try {
    return new PublicKey(s);
  } catch {
    return undefined;
  }
};

export function AgentsPage() {
  const { agents, isLoading, refetch } = useMyAgents();
  return (
    <div className="app-page">
      <h1 className="display app-title">Agents</h1>
      <p className="lede muted">
        Each agent gets its own account on Solana. You own it and can always withdraw. The agent&apos;s key can only request
        payments inside the policy you set here, enforced by the Unslept program.
      </p>
      <CreateAgent nextId={agents.reduce((m, a) => (a.agentId >= m ? a.agentId + 1n : m), 1n)} onDone={refetch} />
      {isLoading ? <p className="muted">Loading agents</p> : null}
      {!isLoading && agents.length === 0 ? <p className="muted">No agents yet. Create one above, then fund it and put its balance to work.</p> : null}
      {agents.map((a) => (
        <AgentCard key={a.address.toBase58()} a={a} onChange={refetch} />
      ))}
    </div>
  );
}

function CreateAgent({ nextId, onDone }: { nextId: bigint; onDone: () => void }) {
  const { address } = useSolanaWallet();
  const [signer, setSigner] = useState("");
  const [perCall, setPerCall] = useState("1");
  const [daily, setDaily] = useState("20");
  const signerKey = toKey(signer);
  const pc = parseUsdc(perCall);
  const dc = parseUsdc(daily);
  const valid = !!signerKey && pc !== undefined && dc !== undefined && pc <= dc;
  const agent = address ? agentAddress(address, nextId) : undefined;

  return (
    <section className="app-panel" aria-labelledby="create-agent">
      <h2 id="create-agent">Create an agent account</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="signer">Agent signer address</label>
          <input id="signer" value={signer} onChange={(e) => setSigner(e.target.value.trim())} placeholder="Solana public key" spellCheck={false} />
          <p className="field__hint">The key your agent runs with (solana-keygen new). Keep it separate from your own wallet.</p>
        </div>
        <div className="field">
          <label htmlFor="pc">Per-call cap (USDC)</label>
          <input id="pc" inputMode="decimal" value={perCall} onChange={(e) => setPerCall(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="dc">Daily cap (USDC)</label>
          <input id="dc" inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} />
        </div>
      </div>
      {signer && !signerKey ? <p className="app-error">The signer must be a Solana public key (base58).</p> : null}
      {pc !== undefined && dc !== undefined && pc > dc ? <p className="app-error">The per-call cap cannot be above the daily cap.</p> : null}
      <TxPreview
        summary={`Creates agent account ${agent ? shortAddr(agent.toBase58()) : ""} owned by ${shortAddr(address?.toBase58())}. The signer can request payments up to ${fmtUsdc(pc ?? 0n)} USDC per call and ${fmtUsdc(dc ?? 0n)} USDC a day. It can never withdraw.`}
        rows={[
          { label: "Protocol fee", value: "None" },
          { label: "Network cost", value: "About 0.004 SOL account rent, plus the network fee" },
        ]}
      />
      <TxButton
        label="Create agent account"
        doneLabel="Created agent account"
        disabled={!valid}
        build={address && signerKey && pc !== undefined && dc !== undefined ? () => build.createAgent(address, nextId, signerKey, pc, dc) : undefined}
        onDone={onDone}
      />
    </section>
  );
}

function AgentCard({ a, onChange }: { a: AgentInfo; onChange: () => void }) {
  const payments = usePayments([a.address], 25);
  const [tab, setTab] = useState<"policy" | "funds" | "log">("funds");
  const id = a.address.toBase58();

  return (
    <article id={id} className="app-panel agent-card" aria-label={`Agent ${id}`}>
      <header className="agent-card__head">
        <div>
          <h2 className="num" title={id}>
            {shortAddr(id)}
          </h2>
          <p className="muted small num">
            Signer {a.revoked ? "removed" : shortAddr(a.signer.toBase58())}{" "}
            <a className="text-link" href={addressUrl(id)} target="_blank" rel="noopener noreferrer">
              Explorer
            </a>
          </p>
        </div>
        <span className={a.paused || a.revoked ? "badge badge--off" : "badge"}>{a.revoked ? "Revoked" : a.paused ? "Paused" : "Active"}</span>
      </header>

      <dl className="kv-row">
        <div>
          <dt>Working in Kamino</dt>
          <dd className="num">{fmtUsdc(a.positionValue)}</dd>
        </div>
        <div>
          <dt>Liquid</dt>
          <dd className="num">{fmtUsdc(a.liquid)}</dd>
        </div>
        <div>
          <dt>Owed to buffer</dt>
          <dd className="num">{fmtUsdc(a.debt)}</dd>
        </div>
        <div>
          <dt>Left today</dt>
          <dd className="num">{fmtUsdc(a.remainingToday)}</dd>
        </div>
      </dl>

      <div role="tablist" aria-label="Agent sections" className="seg">
        {(["funds", "policy", "log"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className="seg__btn" onClick={() => setTab(t)} type="button">
            {t === "policy" ? "Spending policy" : t === "funds" ? "Funds" : "Payment log"}
          </button>
        ))}
      </div>

      {tab === "policy" ? <PolicyEditor a={a} onDone={onChange} /> : null}
      {tab === "funds" ? <FundsPanel a={a} onDone={onChange} /> : null}
      {tab === "log" ? (
        payments.isLoading ? (
          <p className="muted">Loading payments</p>
        ) : payments.data && payments.data.length > 0 ? (
          <PaymentTable rows={payments.data} />
        ) : (
          <p className="muted">No payments yet. Point your agent at an x402 endpoint with the SDK or MCP server.</p>
        )
      ) : null}

      {!a.revoked ? (
        <div className="agent-card__danger">
          <OwnerTx
            variant="ghost"
            label={a.paused ? "Resume agent" : "Pause agent"}
            doneLabel={a.paused ? "Resumed agent" : "Paused agent"}
            make={(o) => build.setAgentPaused(o, a.address, !a.paused)}
            onDone={onChange}
          />
          <RevokeButton a={a} onDone={onChange} />
        </div>
      ) : null}
    </article>
  );
}

function OwnerTx(props: {
  label: string;
  doneLabel: string;
  make: (owner: PublicKey) => ReturnType<typeof build.revoke>;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  onDone: () => void;
}) {
  const { address } = useSolanaWallet();
  return (
    <TxButton
      label={props.label}
      doneLabel={props.doneLabel}
      variant={props.variant}
      disabled={props.disabled}
      build={address ? () => props.make(address) : undefined}
      onDone={props.onDone}
    />
  );
}

function PolicyEditor({ a, onDone }: { a: AgentInfo; onDone: () => void }) {
  const [perCall, setPerCall] = useState(fmtUsdc(a.perCallCap).replace(/,/g, ""));
  const [daily, setDaily] = useState(fmtUsdc(a.dailyCap).replace(/,/g, ""));
  const [entry, setEntry] = useState("");
  const [newSigner, setNewSigner] = useState("");
  const pc = parseUsdc(perCall);
  const dc = parseUsdc(daily);
  const changed = pc !== a.perCallCap || dc !== a.dailyCap;
  const entryKey = entry.length >= 32 ? toAddr(entry) : undefined;
  const signerKey = toKey(newSigner);
  const list = a.allowlist;

  return (
    <div className="policy">
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`pc-${a.address}`}>Per-call cap (USDC)</label>
          <input id={`pc-${a.address}`} inputMode="decimal" value={perCall} onChange={(e) => setPerCall(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`dc-${a.address}`}>Daily cap (USDC)</label>
          <input id={`dc-${a.address}`} inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} />
        </div>
      </div>
      {changed && pc !== undefined && dc !== undefined ? (
        <>
          <TxPreview
            summary="Updates the limits the agent's key is held to. Payments above them are rejected on-chain."
            rows={[
              { label: "Per-call cap", value: `${fmtUsdc(a.perCallCap)} → ${fmtUsdc(pc)} USDC` },
              { label: "Daily cap", value: `${fmtUsdc(a.dailyCap)} → ${fmtUsdc(dc)} USDC` },
            ]}
          />
          <OwnerTx label="Save spending policy" doneLabel="Saved spending policy" disabled={pc > dc} make={(o) => build.setPolicy(o, a.address, pc, dc)} onDone={onDone} />
        </>
      ) : null}

      <h3>Allowlisted payees</h3>
      <p className="muted small">Merchant wallets the agent may pay, up to 8. An empty list lets the agent pay any merchant within its caps.</p>
      <ul className="chip-list">
        {list.map((p) => (
          <li key={p.toBase58()} className="chip num">
            {shortAddr(p.toBase58())}
            <OwnerTx
              variant="ghost"
              label={`Remove ${shortAddr(p.toBase58())}`}
              doneLabel={`Removed ${shortAddr(p.toBase58())}`}
              make={(o) => build.setAllowlist(o, a.address, list.filter((x) => !x.equals(p)))}
              onDone={onDone}
            />
          </li>
        ))}
        {list.length === 0 ? <li className="muted">None. Every payee is allowed within the caps.</li> : null}
      </ul>
      <div className="field">
        <label htmlFor={`entry-${a.address}`}>Add a payee wallet</label>
        <input id={`entry-${a.address}`} value={entry} onChange={(e) => setEntry(e.target.value.trim())} placeholder="Merchant Solana address" spellCheck={false} />
      </div>
      {entry && !entryKey ? <p className="app-error">Enter a Solana wallet address.</p> : null}
      {entryKey && list.length < 8 ? (
        <OwnerTx
          label={`Allow ${shortAddr(entry)}`}
          doneLabel={`Allowed ${shortAddr(entry)}`}
          make={(o) => build.setAllowlist(o, a.address, [...list, entryKey])}
          onDone={() => {
            setEntry("");
            onDone();
          }}
        />
      ) : null}

      {!a.revoked ? (
        <>
          <h3>Agent signer</h3>
          <div className="field">
            <label htmlFor={`sg-${a.address}`}>Rotate to a new signer</label>
            <input id={`sg-${a.address}`} value={newSigner} onChange={(e) => setNewSigner(e.target.value.trim())} placeholder="New signer public key" spellCheck={false} />
          </div>
          {signerKey ? (
            <OwnerTx label="Rotate signer" doneLabel="Rotated signer" make={(o) => build.setSigner(o, a.address, signerKey)} onDone={onDone} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function useWalletUsdc() {
  const { address } = useSolanaWallet();
  return useQuery({
    queryKey: ["wallet-usdc", address?.toBase58()],
    enabled: !!address,
    queryFn: async () => {
      const r = await getConnection().getTokenAccountBalance(ata(address!, USDC_MINT), "confirmed").catch(() => undefined);
      return r ? BigInt(r.value.amount) : 0n;
    },
  });
}

export function FundsPanel({ a, onDone }: { a: AgentInfo; onDone: () => void }) {
  const wallet = useWalletUsdc();
  const config = useConfig();
  const [fund, setFund] = useState("");
  const [toYield, setToYield] = useState("");
  const [out, setOut] = useState("");
  const walletBal = wallet.data ?? 0n;
  const f = parseUsdc(fund);
  const y = parseUsdc(toYield);
  const w = parseUsdc(out);
  const yieldOn = !!config.data && !config.data.yieldReserve.equals(PublicKey.default);
  const outMax = useMemo(() => {
    // Remaining debt must stay within 95% of the Kamino position.
    const room = (a.positionValue * 95n) / 100n;
    return a.debt <= room ? a.liquid : 0n;
  }, [a]);
  const done = () => {
    onDone();
    void wallet.refetch();
  };

  return (
    <div className="funds">
      <div className="field">
        <label htmlFor={`fund-${a.address}`}>Add USDC from your wallet</label>
        <input id={`fund-${a.address}`} inputMode="decimal" value={fund} onChange={(e) => setFund(e.target.value)} placeholder="0.00" />
        <p className="field__hint num">Wallet: {fmtUsdc(walletBal)} USDC</p>
      </div>
      {f !== undefined && f > 0n ? (
        <>
          <TxPreview
            summary={`Sends ${fmtUsdc(f)} USDC from your wallet to this agent's vault. It stays yours and you can withdraw it any time.`}
            rows={[
              { label: "Protocol fee", value: "None" },
              { label: "Wallet after", value: `${fmtUsdc(walletBal - f)} USDC` },
              { label: "Agent liquid after", value: `${fmtUsdc(a.liquid + f)} USDC` },
            ]}
          />
          <OwnerTx label={`Add ${fmtUsdc(f)} USDC`} doneLabel={`Added ${fmtUsdc(f)} USDC`} disabled={f > walletBal} make={(o) => build.fundAgent(o, a.address, f)} onDone={() => (setFund(""), done())} />
        </>
      ) : null}

      {yieldOn ? (
        <EligibilityGate action="Moving funds into Kamino">
          <div className="field">
            <label htmlFor={`y-${a.address}`}>Put liquid USDC to work in Kamino</label>
            <input id={`y-${a.address}`} inputMode="decimal" value={toYield} onChange={(e) => setToYield(e.target.value)} placeholder="0.00" />
            <p className="field__hint num">Liquid now: {fmtUsdc(a.liquid)} USDC. Keep a little liquid so payments repay the buffer at once.</p>
          </div>
          {y !== undefined && y > 0n ? (
            <>
              <TxPreview
                summary={`Supplies ${fmtUsdc(y)} USDC to the Kamino Main Market USDC reserve. The agent receives cUSDC, which earns the variable lending rate. The position backs buffer debt up to 95% of its value.`}
                rows={[
                  { label: "Protocol fee", value: "None" },
                  { label: "Working after", value: `${fmtUsdc(a.positionValue + y)} USDC` },
                ]}
              />
              <OwnerTx label={`Deposit ${fmtUsdc(y)} USDC to Kamino`} doneLabel={`Deposited ${fmtUsdc(y)} USDC to Kamino`} disabled={y > a.liquid} make={(o) => build.yieldDeposit(o, a.address, y)} onDone={() => (setToYield(""), done())} />
            </>
          ) : null}
        </EligibilityGate>
      ) : null}

      {a.ctokens > 0n ? (
        <div className="positions">
          <h3>Kamino position</h3>
          <div className="position-row">
            <span className="num">
              {fmtUsdc(a.ctokens, { decimals: 6 })} cUSDC, deposited {fmtUsdc(a.positionValue)} USDC
            </span>
            <OwnerTx
              variant="ghost"
              label="Redeem all to liquid"
              doneLabel="Redeemed to liquid"
              make={(o) => build.yieldRedeem(o, a.address, a.ctokens)}
              onDone={done}
            />
          </div>
          <p className="muted small">Redeeming repays any buffer debt first; the rest, interest included, lands in the agent&apos;s liquid balance.</p>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor={`out-${a.address}`}>Withdraw liquid USDC to your wallet</label>
        <input id={`out-${a.address}`} inputMode="decimal" value={out} onChange={(e) => setOut(e.target.value)} placeholder="0.00" />
        <p className="field__hint num">Withdrawable now: {fmtUsdc(outMax)} USDC. Kamino funds come back through Redeem first.</p>
      </div>
      {w !== undefined && w > 0n ? (
        <>
          <TxPreview summary="Sends liquid USDC from the agent's vault to your wallet. Allowed even while the protocol is paused." rows={[{ label: "Protocol fee", value: "None" }]} />
          <OwnerTx label={`Withdraw ${fmtUsdc(w)} USDC`} doneLabel={`Withdrew ${fmtUsdc(w)} USDC`} disabled={w > outMax} make={(o) => build.agentWithdraw(o, a.address, w)} onDone={() => (setOut(""), done())} />
        </>
      ) : null}
    </div>
  );
}

function RevokeButton({ a, onDone }: { a: AgentInfo; onDone: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn btn--ghost" onClick={() => setOpen(true)}>
        Revoke agent
      </button>
    );
  }
  return (
    <div className="revoke">
      <p>
        Revoking removes the agent key for good. You keep the account and every withdrawal right. Type <strong>revoke</strong> to confirm.
      </p>
      <input aria-label="Type revoke to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <OwnerTx label="Revoke agent" doneLabel="Revoked agent" disabled={confirm !== "revoke"} make={(o) => build.revoke(o, a.address)} onDone={onDone} />
    </div>
  );
}
