# Unslept — build plan

Status: Phases 1 to 4 built, targeting Robinhood Chain mainnet (no testnet track). Not deployed, not audited.
The interfaces below were the plan; the shipped contracts in `contracts/src` are the source of truth.

## 1. File structure (monorepo)

```
unslept/
├── .env.example                  every chain, RPC, address, fee bound (documented)
├── PLAN.md
├── web/                          Next.js App Router, TypeScript, Tailwind v4
│   ├── src/app/
│   │   ├── layout.tsx            fonts, theme bootstrap, metadata
│   │   ├── page.tsx              landing (sections 1 to 10)
│   │   ├── risk/page.tsx         full risk disclosure
│   │   ├── terms/page.tsx        placeholder, pending legal review
│   │   ├── privacy/page.tsx      placeholder, pending legal review
│   │   ├── docs/                 docs skeleton (overview, quickstart, x402, sdk, mcp, contracts)
│   │   ├── api/waitlist/route.ts POST email + wallet, pluggable store
│   │   ├── api/stats/route.ts    Phase 2: reads indexer; returns "prelaunch" until configured
│   │   └── app/                  Phase 2: overview, agents, buffer, treasury, developers, settings
│   ├── src/components/landing/   one file per section + MoneyClock
│   ├── src/lib/config.ts         typed env reader, no defaults for chain values
│   ├── src/lib/waitlist-store.ts Supabase REST store or local JSON (dev only)
│   └── src/styles/tokens.css     design tokens (single source of truth)
├── contracts/                    Phase 2: Foundry
│   ├── src/UnsleptBuffer.sol
│   ├── src/AgentAccount.sol
│   ├── src/Allocator.sol
│   ├── src/SettlementRouter.sol
│   ├── src/FeeModule.sol
│   ├── src/adapters/{IAssetAdapter,MockAssetAdapter,ReferenceAdapter}.sol
│   ├── script/Deploy.s.sol       reads every address from env
│   └── test/                     unit, fuzz, invariant (buffer solvency)
├── indexer/                      Phase 2: Ponder
├── packages/
│   ├── sdk-ts/                   Phase 3: @unslept/sdk
│   ├── sdk-py/                   Phase 3: unslept (+ LangChain tool)
│   └── mcp/                      Phase 3: @unslept/mcp
```

## 2. Contract interfaces (Phase 2 target)

```solidity
interface IAssetAdapter {
    function asset() external view returns (address);          // underlying (USDG)
    function position() external view returns (address);       // tokenized asset, from config
    function deposit(uint256 assets) external returns (uint256 positionUnits);
    function withdraw(uint256 assets, address to) external returns (uint256 withdrawn);
    function totalAssets() external view returns (uint256);    // valued via oracle
    function lastPriceUpdate() external view returns (uint256); // staleness check
    function maxDeposit() external view returns (uint256);      // per-asset cap
}

interface IUnsleptBuffer /* is IERC4626 */ {
    function utilization() external view returns (uint256 bps);
    function pendingSettlements() external view returns (uint256);
    function requestWithdraw(uint256 shares) external returns (uint256 ticket);
    function claimWithdraw(uint256 ticket) external returns (uint256 assets);
    function settle(address payee, uint256 amount, bytes32 paymentId) external; // SettlementRouter only
    function repay(uint256 amount) external;                                     // Allocator only
}

interface IAgentAccount {
    struct Policy { uint256 perCallCap; uint256 dailyCap; bool paused; }
    function owner() external view returns (address);
    function policy() external view returns (Policy memory);
    function isPayeeAllowed(address payee) external view returns (bool);
    function setPolicy(Policy calldata p) external;              // owner
    function setPayee(address payee, bool allowed) external;     // owner
    function revoke() external;                                  // owner: disables agent signer
    function withdraw(address to, uint256 amount) external;      // owner, always available
    function authorizeSettlement(address payee, uint256 amount, bytes32 paymentId) external returns (bool);
}

interface ISettlementRouter {
    event Settled(bytes32 indexed paymentId, address indexed agent, address indexed payee,
                  uint256 amount, uint256 fee, string endpoint);
    function settle(address agent, address payee, uint256 amount, bytes32 paymentId,
                    string calldata endpoint) external returns (uint256 fee);
}

interface IAllocator {
    function allocate(address source, address adapter, uint256 amount) external;
    function unwind(address adapter, uint256 amount) external;
    function rebalance() external; // refill buffer to target ratio
}

interface IFeeModule {
    function MIN_FEE_BPS() external view returns (uint16); // hard-coded bounds
    function MAX_FEE_BPS() external view returns (uint16);
    function feeFor(address agentOwner, uint256 amount) external view returns (uint256);
}
```

Safety baked in from the start: ReentrancyGuard on every external value path, Pausable by multisig,
TimelockController for parameter changes, oracle staleness checks in adapters, per-asset caps,
invariant `buffer.totalAssets() >= buffer.pendingSettlements()`.

## 3. Design tokens

| Token | Dark | Light | Use |
|---|---|---|---|
| `--ink` (bg) | #0E1630 | #E8E6F0 | page background |
| `--surface` | #18234A | #F5F4FA | panels |
| `--surface-2` | #121C3C | #DCD9E8 | recessed areas, code |
| `--fg` | #E8E6F0 | #0E1630 | primary text |
| `--muted` | #8A93B8 | #4A5275 | secondary text (light value darkened for AA) |
| `--line` | #2A3560 | #C3C0D6 | borders |
| `--lamp` | #F2A93B | #8F5507 | accent; light value darkened for AA on paper |
| `--lamp-ink` | #0E1630 | #FFFFFF | text on lamp buttons |
| `--accrual` | #4FD1B5 | #0B6B56 | positive yield values only |

Type: Bricolage Grotesque (display, tight tracking), IBM Plex Sans (body, UI, tabular numbers).
Base 17 px, measure under 70ch.

## 4. Decisions needed from a human

- Repo location and Vercel project.
- Waitlist storage (Supabase table `un_waitlist`, or another store).
- Robinhood Chain chain IDs, RPC, explorer: read from env, never invented.
- Which tokenized asset the reference adapter targets, and in which jurisdictions.
- Compliance provider for KYC and geo-blocking.
- Audit firm and timing.
