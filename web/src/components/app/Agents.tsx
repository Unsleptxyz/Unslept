"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAddress, keccak256, toHex } from "viem";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { fmtUsdg, parseUsdg, shortAddr } from "@/lib/format";
import { abis, addressUrl, addresses, deployBlock } from "@/lib/web3";
import { EligibilityGate } from "./Eligibility";
import { useMyAccounts, usePayments, type AccountInfo } from "./hooks";
import { PaymentTable } from "./Overview";
import { TxButton, TxPreview } from "./Tx";

export function AgentsPage() {
  const { accounts, isLoading, refetch } = useMyAccounts();
  const agents = accounts.filter((a) => !a.isTreasury);
  return (
    <div className="app-page">
      <h1 className="display app-title">Agents</h1>
      <p className="lede muted">
        Each agent gets its own smart account. You own it and can always withdraw. The agent&apos;s key can only request
        payments inside the policy you set here, enforced on-chain.
      </p>
      <CreateAccount kind="agent" onDone={refetch} />
      {isLoading ? <p className="muted">Loading agents</p> : null}
      {!isLoading && agents.length === 0 ? (
        <p className="muted">No agents yet. Create one above, then fund it and allowlist the APIs it pays.</p>
      ) : null}
      {agents.map((a) => (
        <AgentCard key={a.address} a={a} onChange={refetch} />
      ))}
    </div>
  );
}

export function CreateAccount({ kind, onDone }: { kind: "agent" | "treasury"; onDone: () => void }) {
  const { address } = useAccount();
  const [signer, setSigner] = useState("");
  const [perCall, setPerCall] = useState("1");
  const [daily, setDaily] = useState("20");
  const [salt] = useState(() => keccak256(toHex(`${Date.now()}-${Math.random()}`)));
  const isAgent = kind === "agent";
  const pc = parseUsdg(perCall);
  const dc = parseUsdg(daily);
  const valid = isAgent ? isAddress(signer) && pc !== undefined && dc !== undefined && pc <= dc : true;
  const policy = isAgent ? { perCallCap: pc ?? 0n, dailyCap: dc ?? 0n } : { perCallCap: 0n, dailyCap: 0n };

  return (
    <section className="app-panel" aria-labelledby={`create-${kind}`}>
      <h2 id={`create-${kind}`}>{isAgent ? "Create an agent account" : "Create a treasury account"}</h2>
      {isAgent ? (
        <div className="form-grid">
          <div className="field">
            <label htmlFor="signer">Agent signer address</label>
            <input id="signer" value={signer} onChange={(e) => setSigner(e.target.value.trim())} placeholder="0x..." spellCheck={false} />
            <p className="field__hint">The key your agent runs with. Keep it separate from your own wallet.</p>
          </div>
          <div className="field">
            <label htmlFor="pc">Per-call cap (USDG)</label>
            <input id="pc" inputMode="decimal" value={perCall} onChange={(e) => setPerCall(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="dc">Daily cap (USDG)</label>
            <input id="dc" inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} />
          </div>
        </div>
      ) : (
        <p className="muted">A treasury account has no agent key. Only you can move funds; idle balance can be parked in tokenized assets.</p>
      )}
      {isAgent && signer && !isAddress(signer) ? <p className="app-error">The signer must be 0x followed by 40 hexadecimal characters.</p> : null}
      {isAgent && pc !== undefined && dc !== undefined && pc > dc ? <p className="app-error">The per-call cap cannot be above the daily cap.</p> : null}
      <TxPreview
        summary={
          isAgent
            ? `Creates an agent account owned by ${shortAddr(address)}. The signer can request payments up to ${fmtUsdg(policy.perCallCap)} USDG per call and ${fmtUsdg(policy.dailyCap)} USDG a day, to allowlisted payees only. It can never withdraw.`
            : `Creates a treasury account owned by ${shortAddr(address)}.`
        }
        rows={[
          { label: "Protocol fee", value: "None" },
          { label: "Network fee", value: "Gas, paid in ETH" },
        ]}
      />
      <TxButton
        label={isAgent ? "Create agent account" : "Create treasury account"}
        doneLabel={isAgent ? "Created agent account" : "Created treasury account"}
        disabled={!valid}
        request={{
          address: addresses.factory,
          abi: abis.factory,
          functionName: "createAccount",
          args: [isAgent ? signer : "0x0000000000000000000000000000000000000000", policy, salt],
        }}
        onDone={onDone}
      />
    </section>
  );
}

/** Current payee and domain allowlists, rebuilt from the account's events. */
function useAllowlists(account: `0x${string}`) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["allowlists", account],
    enabled: !!client,
    queryFn: async () => {
      const get = (eventName: string) =>
        client!.getContractEvents({ address: account, abi: abis.agentAccount, eventName, fromBlock: deployBlock } as never) as unknown as Promise<
          { args: { payee?: string; domain?: string; allowed: boolean } }[]
        >;
      const [p, d] = await Promise.all([get("PayeeSet"), get("DomainSet")]);
      const payees = new Map<string, boolean>();
      p.forEach((l) => payees.set(l.args.payee!.toLowerCase(), l.args.allowed));
      const domains = new Map<string, boolean>();
      d.forEach((l) => domains.set(l.args.domain!, l.args.allowed));
      return {
        payees: [...payees].filter(([, v]) => v).map(([k]) => k as `0x${string}`),
        domains: [...domains].filter(([, v]) => v).map(([k]) => k),
      };
    },
  });
}

function AgentCard({ a, onChange }: { a: AccountInfo; onChange: () => void }) {
  const { address } = useAccount();
  const allow = useAllowlists(a.address);
  const payments = usePayments([a.address], 25);
  const [tab, setTab] = useState<"policy" | "funds" | "log">("policy");
  const acct = { address: a.address, abi: abis.agentAccount };
  const refresh = () => {
    onChange();
    void allow.refetch();
  };

  return (
    <article id={a.address} className="app-panel agent-card" aria-label={`Agent ${a.address}`}>
      <header className="agent-card__head">
        <div>
          <h2 className="num">{shortAddr(a.address)}</h2>
          <p className="muted small num">
            Signer {a.revoked ? "removed" : shortAddr(a.signer)}
            {addressUrl(a.address) ? (
              <>
                {" "}
                <a className="text-link" href={addressUrl(a.address)} target="_blank" rel="noopener noreferrer">
                  Explorer
                </a>
              </>
            ) : null}
          </p>
        </div>
        <span className={a.paused || a.revoked ? "badge badge--off" : "badge"}>{a.revoked ? "Revoked" : a.paused ? "Paused" : "Active"}</span>
      </header>

      <dl className="kv-row">
        <div>
          <dt>Working</dt>
          <dd className="num">{fmtUsdg(a.parked)}</dd>
        </div>
        <div>
          <dt>Liquid</dt>
          <dd className="num">{fmtUsdg(a.liquid)}</dd>
        </div>
        <div>
          <dt>Owed to buffer</dt>
          <dd className="num">{fmtUsdg(a.debt)}</dd>
        </div>
        <div>
          <dt>Left today</dt>
          <dd className="num">{fmtUsdg(a.remainingToday)}</dd>
        </div>
      </dl>

      <div role="tablist" aria-label="Agent sections" className="seg">
        {(["policy", "funds", "log"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className="seg__btn" onClick={() => setTab(t)} type="button">
            {t === "policy" ? "Spending policy" : t === "funds" ? "Funds" : "Payment log"}
          </button>
        ))}
      </div>

      {tab === "policy" ? <PolicyEditor a={a} payees={allow.data?.payees ?? []} domains={allow.data?.domains ?? []} onDone={refresh} /> : null}

      {tab === "funds" ? <FundsPanel a={a} owner={address} onDone={onChange} /> : null}

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
          <TxButton
            variant="ghost"
            label={a.paused ? "Resume agent" : "Pause agent"}
            doneLabel={a.paused ? "Resumed agent" : "Paused agent"}
            request={{ ...acct, functionName: "setPaused", args: [!a.paused] }}
            onDone={onChange}
          />
          <RevokeButton account={a.address} onDone={onChange} />
        </div>
      ) : null}
    </article>
  );
}

function PolicyEditor({ a, payees, domains, onDone }: { a: AccountInfo; payees: `0x${string}`[]; domains: string[]; onDone: () => void }) {
  const [perCall, setPerCall] = useState(fmtUsdg(a.perCallCap).replace(/,/g, ""));
  const [daily, setDaily] = useState(fmtUsdg(a.dailyCap).replace(/,/g, ""));
  const [entry, setEntry] = useState("");
  const pc = parseUsdg(perCall);
  const dc = parseUsdg(daily);
  const changed = pc !== a.perCallCap || dc !== a.dailyCap;
  const acct = { address: a.address, abi: abis.agentAccount };
  const entryIsAddr = isAddress(entry);
  const entryDomain = entry.trim().toLowerCase();
  const entryIsDomain = !entryIsAddr && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(entryDomain);

  return (
    <div className="policy">
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`pc-${a.address}`}>Per-call cap (USDG)</label>
          <input id={`pc-${a.address}`} inputMode="decimal" value={perCall} onChange={(e) => setPerCall(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`dc-${a.address}`}>Daily cap (USDG)</label>
          <input id={`dc-${a.address}`} inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} />
        </div>
      </div>
      {changed && pc !== undefined && dc !== undefined ? (
        <>
          <TxPreview
            summary="Updates the limits the agent's key is held to. Payments above them are rejected on-chain."
            rows={[
              { label: "Per-call cap", value: `${fmtUsdg(a.perCallCap)} → ${fmtUsdg(pc)} USDG` },
              { label: "Daily cap", value: `${fmtUsdg(a.dailyCap)} → ${fmtUsdg(dc)} USDG` },
            ]}
          />
          <TxButton
            label="Save spending policy"
            doneLabel="Saved spending policy"
            disabled={pc > dc}
            request={{ ...acct, functionName: "setPolicy", args: [{ perCallCap: pc, dailyCap: dc }] }}
            onDone={onDone}
          />
        </>
      ) : null}

      <h3>Allowlisted payees</h3>
      <p className="muted small">Addresses are enforced strictly on-chain. Domains rely on the host the SDK reports, so prefer addresses.</p>
      <ul className="chip-list">
        {payees.map((p) => (
          <li key={p} className="chip num">
            {shortAddr(p)}
            <TxButton variant="ghost" label={`Remove ${shortAddr(p)}`} doneLabel={`Removed ${shortAddr(p)}`} request={{ ...acct, functionName: "setPayee", args: [p, false] }} onDone={onDone} />
          </li>
        ))}
        {domains.map((d) => (
          <li key={d} className="chip">
            {d}
            <TxButton variant="ghost" label={`Remove ${d}`} doneLabel={`Removed ${d}`} request={{ ...acct, functionName: "setDomain", args: [d, false] }} onDone={onDone} />
          </li>
        ))}
        {payees.length + domains.length === 0 ? <li className="muted">None yet. The agent cannot pay anyone until you add a payee.</li> : null}
      </ul>
      <div className="field">
        <label htmlFor={`entry-${a.address}`}>Add a payee address or domain</label>
        <input id={`entry-${a.address}`} value={entry} onChange={(e) => setEntry(e.target.value.trim())} placeholder="0x... or api.example.com" spellCheck={false} />
      </div>
      {entry && !entryIsAddr && !entryIsDomain ? <p className="app-error">Enter an EVM address or a host name such as api.example.com.</p> : null}
      {entryIsAddr || entryIsDomain ? (
        <TxButton
          label={`Allow ${entryIsAddr ? shortAddr(entry) : entryDomain}`}
          doneLabel={`Allowed ${entryIsAddr ? shortAddr(entry) : entryDomain}`}
          request={entryIsAddr ? { ...acct, functionName: "setPayee", args: [entry, true] } : { ...acct, functionName: "setDomain", args: [entryDomain, true] }}
          onDone={() => {
            setEntry("");
            onDone();
          }}
        />
      ) : null}
    </div>
  );
}

export function FundsPanel({ a, owner, onDone }: { a: AccountInfo; owner?: `0x${string}`; onDone: () => void }) {
  const [fund, setFund] = useState("");
  const [out, setOut] = useState("");
  const wallet = useReadContract({ address: addresses.usdg, abi: abis.erc20, functionName: "balanceOf", args: owner ? [owner] : undefined, query: { enabled: !!owner } });
  const walletBal = (wallet.data as bigint | undefined) ?? 0n;
  const f = parseUsdg(fund);
  const w = parseUsdg(out);
  const acct = { address: a.address, abi: abis.agentAccount };
  const total = a.liquid + a.parked;
  const outMax = useMemo(() => (a.liquid > a.debt ? a.liquid - a.debt : 0n), [a]);

  return (
    <div className="funds">
      <EligibilityGate action="Funding an account that parks idle balance in tokenized assets">
        <div className="field">
          <label htmlFor={`fund-${a.address}`}>Add USDG from your wallet</label>
          <input id={`fund-${a.address}`} inputMode="decimal" value={fund} onChange={(e) => setFund(e.target.value)} placeholder="0.00" />
          <p className="field__hint num">Wallet: {fmtUsdg(walletBal)} USDG</p>
        </div>
        {f !== undefined && f > 0n ? (
          <>
            <TxPreview
              summary={`Sends ${fmtUsdg(f)} USDG from your wallet to this account. ${a.autoAllocate ? "The allocator can park it in tokenized assets; it stays yours." : "Automatic allocation is off, so it stays liquid."}`}
              rows={[
                { label: "Protocol fee", value: "None" },
                { label: "Wallet after", value: `${fmtUsdg(walletBal - f)} USDG` },
                { label: "Account after", value: `${fmtUsdg(total + f)} USDG` },
              ]}
            />
            <TxButton
              label={`Add ${fmtUsdg(f)} USDG`}
              doneLabel={`Added ${fmtUsdg(f)} USDG`}
              disabled={f > walletBal}
              request={{ address: addresses.usdg, abi: abis.erc20, functionName: "transfer", args: [a.address, f] }}
              onDone={() => {
                setFund("");
                onDone();
                void wallet.refetch();
              }}
            />
          </>
        ) : null}
      </EligibilityGate>

      <div className="field">
        <label htmlFor={`out-${a.address}`}>Withdraw liquid USDG to your wallet</label>
        <input id={`out-${a.address}`} inputMode="decimal" value={out} onChange={(e) => setOut(e.target.value)} placeholder="0.00" />
        <p className="field__hint num">
          Withdrawable now: {fmtUsdg(outMax)} USDG. Parked funds come back through Unwind first.
        </p>
      </div>
      {w !== undefined && w > 0n ? (
        <>
          <TxPreview
            summary="Repays any buffer debt from liquid USDG first, then sends the rest of the amount to your wallet."
            rows={[
              { label: "Protocol fee", value: "None" },
              { label: "Account after", value: `${fmtUsdg(total - a.debt - w)} USDG` },
            ]}
          />
          <TxButton
            label={`Withdraw ${fmtUsdg(w)} USDG`}
            doneLabel={`Withdrew ${fmtUsdg(w)} USDG`}
            disabled={!owner || w > outMax}
            request={{ ...acct, functionName: "withdraw", args: [owner, w] }}
            onDone={() => {
              setOut("");
              onDone();
            }}
          />
        </>
      ) : null}

      {a.positions.length > 0 ? (
        <div className="positions">
          <h3>Parked positions</h3>
          {a.positions.map((p) => (
            <div key={p} className="position-row">
              <span className="num">{shortAddr(p)}</span>
              <TxButton
                variant="ghost"
                label="Unwind all to liquid"
                doneLabel="Unwound to liquid"
                request={{ ...acct, functionName: "ownerUnwind", args: [p, 2n ** 255n] }}
                onDone={onDone}
              />
            </div>
          ))}
        </div>
      ) : null}
      <TxButton
        variant="ghost"
        label={a.autoAllocate ? "Turn off automatic allocation" : "Turn on automatic allocation"}
        doneLabel={a.autoAllocate ? "Turned off automatic allocation" : "Turned on automatic allocation"}
        request={{ ...acct, functionName: "setAutoAllocate", args: [!a.autoAllocate] }}
        onDone={onDone}
      />
    </div>
  );
}

function RevokeButton({ account, onDone }: { account: `0x${string}`; onDone: () => void }) {
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
      <TxButton
        label="Revoke agent"
        doneLabel="Revoked agent"
        disabled={confirm !== "revoke"}
        request={{ address: account, abi: abis.agentAccount, functionName: "revoke" }}
        onDone={onDone}
      />
    </div>
  );
}
