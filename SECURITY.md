# Security policy

Unslept holds user funds on Robinhood Chain mainnet. We take reports seriously and respond as fast as we can.

## Status

The contracts are in a guarded launch: deployed without a completed third-party audit, with total buffer deposits
and each asset adapter capped at 50,000 USDG. Admin changes go through a 24-hour timelock, and the protocol can be
paused in an emergency. Owners can always exit their agent accounts, subject to the contract rules.

## Reporting a vulnerability

Report privately through a **GitHub security advisory**: open the repository's **Security** tab and choose
**Report a vulnerability**. Do not open a public issue, post on social media or test against mainnet funds.

Please include:

- the affected contract, package or page, and the commit or deployed address
- a description of the impact and the conditions needed
- steps or a proof of concept, ideally as a Foundry test against a mainnet fork

We aim to acknowledge reports within 72 hours and to keep you updated until the issue is resolved. We will credit
you in the fix notes unless you prefer otherwise.

## In scope

- Contracts listed in `contracts/deployments/4663.json`
- `@unslept/sdk`, `@unslept/mcp` and the `unslept` Python package
- The website and its API routes, including the x402 demo endpoint

## Out of scope

- Issues in third-party systems: Robinhood Chain, USDG (Paxos), Spark, wallets, Vercel, Supabase
- Attacks that need a compromised owner or agent signing key
- Denial of service through spam, and missing best-practice headers without a concrete impact

## Safe harbor

Good-faith research that follows this policy, avoids harm to users and does not move funds you do not own will not
be pursued by the project.
