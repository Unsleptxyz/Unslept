import type { Metadata } from "next";
import { LongformPage } from "@/components/PageShell";
import { Callout, DefTable, Summary } from "@/components/content/Blocks";

export const metadata: Metadata = {
  title: "Risk disclosure",
  description: "The risks of using Unslept: smart contract, tokenized asset, liquidity, depeg, regulatory, key and token risk.",
};

export default function RiskPage() {
  return (
    <LongformPage
      eyebrow="Trust"
      title="Risk disclosure"
      updated="31 October 2026"
      intro={
        <p className="lede">
          Unslept is experimental software. Using it can lose you money. This page explains each risk in plain language, what
          the protocol does about it, and what remains your responsibility. Read it in full before you deposit, connect an
          agent or park treasury funds.
        </p>
      }
      summary={
        <Summary
          items={[
            "The contracts are live without a completed third-party audit. Deposits are capped at 50,000 USDG, which limits but does not prevent losses.",
            "Idle balances sit in Spark Savings USDG. Its value and rate depend on Spark and on the strategies behind it.",
            "Everything is denominated in USDG, issued by Paxos. A depeg or a freeze would affect your funds.",
            "Withdrawals can be delayed when the buffer is heavily used.",
            "Yields are variable and not guaranteed. Nothing here is investment, legal or tax advice.",
          ]}
        />
      }
    >
      <h2>Smart contract risk</h2>
      <p>
        Unslept runs on smart contracts: the buffer vault, agent accounts and their factory, the allocator, the settlement
        router, the fee module and the asset adapter. A bug, a flawed parameter change or an unexpected interaction between
        contracts could lock or lose funds.
      </p>
      <p>
        <strong>What the protocol does about it.</strong> The contracts are tested with unit, fuzz and invariant tests, and
        with a fork test against the live mainnet contracts. Every source is verified, so anyone can read what runs. Total
        buffer deposits and each asset are capped at 50,000 USDG during the guarded launch. Admin changes wait 24 hours in a
        timelock before they take effect.
      </p>
      <p>
        <strong>What remains.</strong> No third-party audit has been completed yet. Tests and caps reduce risk and bound how
        much can be lost; they do not remove the risk. An audit, when it happens, will also reduce risk without removing it.
      </p>
      <p>
        The protocol also depends on contracts and infrastructure it does not control: Robinhood Chain itself, the USDG
        contract, the spUSDG vault, the ERC-4337 entry point, wallets and x402 facilitators.
      </p>

      <h2>Tokenized asset risk</h2>
      <p>
        Idle balances are parked in <strong>Spark Savings USDG (spUSDG)</strong>, an ERC-4626 savings vault on Robinhood
        Chain. Its yield comes from Spark&apos;s deployments across decentralized and traditional finance, so it carries the
        risks of the Spark and Sky protocols and of the strategies behind them. Its value can fall, withdrawals from it can be
        limited, and its terms can change. A vault&apos;s past rate says nothing about its future rate.
      </p>
      <p>
        Other tokenized assets may be added in the future through the timelock. Each one depends on an issuer, a custodian of
        the underlying asset and the legal structure linking them to the token. Issuers can pause, freeze or redeem tokens,
        change terms or fail, and redemptions can be delayed.
      </p>

      <h2>Liquidity and withdrawal risk</h2>
      <p>
        The buffer settles agent payments instantly from shared liquidity, and agents repay it shortly after. When many
        payments are outstanding or many depositors withdraw at once, utilization rises.
      </p>
      <DefTable
        rows={[
          ["Instant withdrawals", "Available while utilization is at or below 80 percent and free liquidity covers the amount."],
          ["Queued withdrawals", "Above that, you request a withdrawal and receive a ticket, served first in, first out as liquidity returns."],
          ["Agent payments", "Can fail if the buffer is short and the agent's own liquid balance cannot cover the payment."],
        ]}
      />
      <p>You may not be able to withdraw immediately, and in a stressed market the wait can be long.</p>

      <h2>Agent debt risk</h2>
      <p>
        When an agent pays while its money is parked, it owes the buffer until the parked position is unwound. The router
        refuses any payment that would leave debt larger than the account is worth, and anyone can trigger repayment. If the
        parked asset lost value quickly, an account&apos;s collateral could fall below its debt. In that case the buffer can
        write off the shortfall, and depositors bear it.
      </p>

      <h2>Depeg and issuer risk</h2>
      <p>
        Balances are denominated in <strong>USDG (Global Dollar)</strong>, issued by Paxos. If USDG trades below one dollar,
        or if the issuer freezes or blacklists addresses, the value of your funds and your ability to use them can be
        affected. Assets priced in dollars carry the same exposure.
      </p>

      <h2>Regulatory risk</h2>
      <p>
        Stablecoins, savings vaults and tokenized assets are regulated differently across jurisdictions, and the rules change.
        Unslept does not verify identities, so it is up to you to make sure using it is allowed where you live. Access may be
        limited from some countries. A change in law, or in the policy of an issuer such as Paxos or a protocol such as Spark,
        could force the protocol to stop offering an asset, unwind positions or restrict access, possibly at a bad time.
      </p>

      <h2>Agent and key risk</h2>
      <p>
        Agents act on their own. A leaked signer key, a loose spending policy or a malicious payee can spend funds within the
        limits you set.
      </p>
      <ul>
        <li>Keep per-call and daily caps as low as your agent allows.</li>
        <li>Allowlist payee addresses rather than host names where you can.</li>
        <li>Use a separate signer key for each agent, never your owner wallet.</li>
        <li>Store signer keys in a secret manager and rotate them if you suspect a leak.</li>
      </ul>
      <p>The owner can always pause the agent, revoke its signer and withdraw, including while funds are parked.</p>

      <h2>Admin and governance risk</h2>
      <p>
        An admin role can change fees within fixed bounds, change caps, add or remove adapters and grant roles. Every such
        change waits 24 hours in a public timelock, which gives everyone time to react and exit. The admin can also pause the
        buffer and the router in an emergency, which stops new payments but does not stop owners from exiting their agent
        accounts. During the guarded launch the admin is a single wallet; it moves to a multisig before caps are raised.
      </p>

      <h2>Token risk</h2>
      <p>
        $UNSLEPT provides fee discounts, access to a staker buffer tier and advisory governance signaling. It is not an
        investment and carries no claim on protocol revenue. Its market price can go to zero. Any form of fee sharing with
        holders is pending legal review and is not live.
      </p>

      <h2>Operational risk</h2>
      <p>
        The website, indexer, keeper, monitor, SDKs and MCP server can be unavailable or show outdated data. On-chain state is
        the source of truth. Always check transactions on the block explorer. If the keeper stops, your funds are not stuck:
        owners can unwind and withdraw directly, and debt settlement is open to anyone.
      </p>

      <Callout tone="warning" title="About yields">
        Yields shown anywhere on Unslept are variable, historical or illustrative. None of them is a projection or a promise.
        Nothing on this site is investment, legal or tax advice.
      </Callout>
    </LongformPage>
  );
}
