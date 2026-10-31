import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Risk disclosure",
  description: "The risks of using Unslept: smart contract, tokenized asset, liquidity, depeg and regulatory risk.",
};

export default function RiskPage() {
  return (
    <PageShell>
      <article className="prose-page">
        <h1 className="display">Risk disclosure</h1>
        <p className="page-intro">
          Unslept is experimental software. Using it can lose you money. Read this page in full before you deposit,
          connect an agent or park treasury funds.
        </p>

        <div className="notice" role="note">
          <p>
            Yields shown anywhere on Unslept are variable, historical or illustrative. None of them is a projection or
            a promise. Nothing on this site is investment, legal or tax advice.
          </p>
        </div>

        <h2>Smart contract risk</h2>
        <p>
          Unslept runs on smart contracts: the buffer vault, agent accounts, the allocator, the settlement router, the
          fee module and asset adapters. A bug, a flawed upgrade or an unexpected interaction between contracts could
          lock or lose funds. The contracts have not yet been audited. Until an audit report is published, deposits
          are limited by guarded caps, which bound how much can be lost but do not prevent a loss. An audit reduces
          risk and does not remove it.
        </p>
        <p>
          The protocol also depends on contracts and infrastructure it does not control, including Robinhood Chain
          itself, the USDG contract, oracles, the ERC-4337 entry point and x402 facilitators.
        </p>

        <h2>Tokenized asset risk</h2>
        <p>
          Idle balances are allocated into tokenized assets on Robinhood Chain, such as short-duration treasury or
          money-market style instruments where available. These assets depend on an issuer, a custodian of the
          underlying asset and the legal structure linking them to the token. Their value can fall. The issuer can
          pause, freeze or redeem tokens, change terms, or fail. Redemptions can be delayed. Prices come from oracles
          that can be wrong or stale; the protocol rejects stale prices, which can delay rebalancing.
        </p>

        <h3>Where idle balances go</h3>
        <p>
          The first supported asset is expected to be a USDG savings vault on Robinhood Chain (Spark Savings USDG). Its
          yield comes from Spark&apos;s deployments across DeFi, CeFi and traditional finance, and it adds the risks of the
          Spark and Sky protocols and of the strategies behind them. A vault&apos;s past rate says nothing about its future rate.
        </p>

        <h2>Liquidity and withdrawal-queue risk</h2>
        <p>
          The buffer settles agent payments instantly from shared liquidity. When many payments are pending or many
          depositors withdraw at once, utilization rises. Above a set threshold, withdrawals enter a queue and are paid
          as liquidity returns from settled positions. You may not be able to withdraw immediately. Agent payments can
          also fail if the buffer and the agent's parked position are both short.
        </p>

        <h2>Depeg risk</h2>
        <p>
          Balances are denominated in USDG (Global Dollar), issued by Paxos. If USDG trades below one dollar, or if its issuer freezes or blacklists
          addresses, the value of your deposit and your ability to use it can be affected. Tokenized assets priced in
          dollars carry the same exposure.
        </p>

        <h2>Regulatory risk</h2>
        <p>
          Stablecoins, savings vaults and tokenized assets are regulated differently across jurisdictions and the
          rules change. Unslept does not verify identities, so it is up to you to make sure using it is allowed where
          you live. Some jurisdictions may be blocked. A change in law, or in the policy of an issuer such as Paxos,
          could force the protocol to stop offering an asset, unwind positions or restrict access, possibly at an
          unfavorable time.
        </p>

        <h2>Agent and key risk</h2>
        <p>
          Agents act automatically. A compromised agent signer, a misconfigured spending policy or a malicious payee
          can spend funds within the limits you set. Keep caps tight, allowlist payees, and keep owner keys separate
          from agent keys. The owner can always pause, revoke and withdraw.
        </p>

        <h2>Token risk</h2>
        <p>
          $UNSLEPT provides fee discounts, access to a staker buffer tier and advisory governance signaling. It is not
          an investment and carries no claim on protocol revenue. Its market price can go to zero. Any form of fee
          sharing with holders is pending legal review and is not live.
        </p>

        <h2>Operational risk</h2>
        <p>
          The website, indexer, SDKs and MCP server can be unavailable or show outdated data. On-chain state is the
          source of truth. Always check transactions on the block explorer.
        </p>
      </article>
    </PageShell>
  );
}
