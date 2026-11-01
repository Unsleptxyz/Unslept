import type { Metadata } from "next";
import { LongformPage } from "@/components/PageShell";
import { Callout, DefTable, Summary } from "@/components/content/Blocks";

export const metadata: Metadata = {
  title: "Risk disclosure",
  description: "The risks of using Unslept: program, lending market, liquidity, depeg, regulatory, key and token risk.",
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
          the protocol does about it, and what remains your responsibility. Read it in full before you deposit, create an
          agent or move funds into Kamino.
        </p>
      }
      summary={
        <Summary
          items={[
            "The Solana program is live without a completed third-party audit. Buffer deposits are capped at 50,000 USDC, which limits but does not prevent losses.",
            "Idle agent balances can sit in Kamino Lend. Their value and rate depend on Kamino and its borrowers.",
            "Everything is denominated in USDC, issued by Circle. A depeg or a freeze would affect your funds.",
            "Withdrawals can be delayed when the buffer is heavily used.",
            "Yields are variable and not guaranteed. Nothing here is investment, legal or tax advice.",
          ]}
        />
      }
    >
      <h2>Program risk</h2>
      <p>
        Unslept runs as one Solana program: the buffer vault, agent accounts and their vaults, payment settlement and the
        Kamino adapter. A bug, a flawed parameter change or an unexpected interaction with Kamino could lock or lose funds.
      </p>
      <p>
        <strong>What the protocol does about it.</strong> The program is tested on a local validator, and its Kamino adapter
        is tested against the real Kamino Lend program and the live Main Market USDC reserve copied from mainnet. The source
        is public, so anyone can read what runs. Buffer deposits are capped at 50,000 USDC during the guarded launch. Parameter
        changes wait 24 hours before they take effect, and withdrawals stay open while the protocol is paused.
      </p>
      <p>
        <strong>What remains.</strong> No third-party audit has been completed yet. Tests and caps reduce risk and bound how
        much can be lost; they do not remove the risk. An audit, when it happens, will also reduce risk without removing it.
      </p>
      <p>
        The protocol also depends on programs and infrastructure it does not control: Solana itself, the USDC mint, the SPL
        Token program, Kamino Lend, RPC providers, wallets and x402 merchants.
      </p>

      <h2>Lending market risk</h2>
      <p>
        Agent owners can supply idle USDC to the <strong>Kamino Lend Main Market USDC reserve</strong>. The yield is the
        interest paid by borrowers, so it rises and falls with demand. The reserve carries Kamino&apos;s risks: a bug in its
        program, a bad oracle price, or borrowers whose collateral cannot cover their loans. When most of the reserve is
        borrowed, redemptions can be limited until borrowers repay. A reserve&apos;s past rate says nothing about its future rate.
      </p>
      <p>
        The reserve is fixed in the program once set, so it cannot be switched to another venue without a program upgrade.
      </p>

      <h2>Liquidity and withdrawal risk</h2>
      <p>
        The buffer settles agent payments instantly from shared liquidity, and agents repay it shortly after. When many
        payments are outstanding or many depositors withdraw at once, utilization rises.
      </p>
      <DefTable
        rows={[
          ["Withdrawals", "Available up to the buffer's free liquidity. The rest returns as agents repay."],
          ["Agent payments", "Fail if the buffer does not hold enough free USDC for the payment."],
        ]}
      />
      <p>You may not be able to withdraw immediately, and in a stressed market the wait can be long.</p>

      <h2>Agent debt risk</h2>
      <p>
        When an agent pays while its money is in Kamino, it owes the buffer until the keeper or the owner redeems. The program
        refuses any payment that would leave debt above 95 percent of the USDC the agent has in Kamino. If Kamino lost value or
        could not redeem, an agent&apos;s collateral could fall below its debt, and depositors would bear the shortfall.
      </p>

      <h2>Depeg and issuer risk</h2>
      <p>
        Balances are denominated in <strong>USDC</strong>, issued by Circle. If USDC trades below one dollar,
        or if the issuer freezes token accounts, the value of your funds and your ability to use them can be
        affected. Assets priced in dollars carry the same exposure.
      </p>

      <h2>Regulatory risk</h2>
      <p>
        Stablecoins and lending markets are regulated differently across jurisdictions, and the rules change.
        Unslept does not verify identities, so it is up to you to make sure using it is allowed where you live. Access may be
        limited from some countries. A change in law, or in the policy of an issuer such as Circle or a protocol such as Kamino,
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
      <p>The owner can always pause the agent, revoke its signer and withdraw, including while funds are in Kamino.</p>

      <h2>Admin and governance risk</h2>
      <p>
        An admin can change the fee (at most 1 percent), the deposit cap, the keeper, the pauser and the treasury. Every such
        change waits 24 hours on-chain, which gives everyone time to react and exit. The admin or pauser can pause deposits and
        payments in an emergency; withdrawals from the buffer and from agent accounts stay open. The program&apos;s upgrade
        authority can change its code. During the guarded launch both are single wallets; they move to a multisig before caps
        are raised.
      </p>

      <h2>Token risk</h2>
      <p>
        $UNSLEPT is planned to provide fee discounts, access to a staker buffer tier and advisory governance signaling. It is not an
        investment and carries no claim on protocol revenue. Its market price can go to zero. Any form of fee sharing with
        holders is pending legal review and is not live.
      </p>

      <h2>Operational risk</h2>
      <p>
        The website, indexer, keeper, monitor, SDKs and MCP server can be unavailable or show outdated data. On-chain state is
        the source of truth. Always check transactions on the block explorer. If the keeper stops, your funds are not stuck:
        owners can redeem from Kamino and withdraw directly, and debt repayment from an agent&apos;s liquid balance is open to anyone.
      </p>

      <Callout tone="warning" title="About yields">
        Yields shown anywhere on Unslept are variable, historical or illustrative. None of them is a projection or a promise.
        Nothing on this site is investment, legal or tax advice.
      </Callout>
    </LongformPage>
  );
}
