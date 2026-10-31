import { index, onchainTable } from "ponder";

export const payment = onchainTable(
  "payment",
  (t) => ({
    id: t.text().primaryKey(), // tx hash + log index
    paymentId: t.hex().notNull(),
    agent: t.hex().notNull(),
    payee: t.hex().notNull(),
    buffer: t.hex().notNull(),
    amount: t.bigint().notNull(),
    fee: t.bigint().notNull(),
    mode: t.integer().notNull(),
    endpoint: t.text().notNull(),
    txHash: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
  }),
  (table) => ({ agentIdx: index().on(table.agent), timeIdx: index().on(table.timestamp) }),
);

export const account = onchainTable("account", (t) => ({
  address: t.hex().primaryKey(),
  owner: t.hex().notNull(),
  signer: t.hex().notNull(),
  treasury: t.boolean().notNull(),
  createdAt: t.integer().notNull(),
}));

/** Share price snapshots, one per buffer per block with activity. Used for the trailing variable rate. */
export const bufferSnapshot = onchainTable(
  "buffer_snapshot",
  (t) => ({
    id: t.text().primaryKey(), // buffer + block
    buffer: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    totalAssets: t.bigint().notNull(),
    assetsPerShare: t.bigint().notNull(), // USDG atomic units per 1e18 shares
    utilizationBps: t.bigint().notNull(),
  }),
  (table) => ({ bufTime: index().on(table.buffer, table.timestamp) }),
);

export const totals = onchainTable("totals", (t) => ({
  id: t.text().primaryKey(), // "global"
  paymentsSettled: t.integer().notNull(),
  volume: t.bigint().notNull(),
  fees: t.bigint().notNull(),
  connectedAgents: t.integer().notNull(),
  valueWorking: t.bigint().notNull(), // sum of adapter totalValue, refreshed on activity
  updatedAt: t.integer().notNull(),
}));

export const alert = onchainTable(
  "alert",
  (t) => ({
    id: t.text().primaryKey(),
    kind: t.text().notNull(), // "policy_violation" | "low_balance"
    agent: t.hex().notNull(),
    detail: t.text().notNull(),
    timestamp: t.integer().notNull(),
  }),
  (table) => ({ agentIdx: index().on(table.agent) }),
);
