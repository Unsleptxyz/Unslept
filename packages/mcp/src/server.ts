/**
 * Unslept MCP server. Dependency-free implementation of the Model Context Protocol over stdio
 * (newline-delimited JSON-RPC 2.0), exposing four tools backed by the Unslept SDK.
 */
import type { Unslept } from "@unslept/sdk";

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "unslept", version: "0.1.0" };
const MAX_BODY = 100_000;

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

/** Minimal surface the server needs, so tests can pass a stub. */
export type UnsleptLike = Pick<Unslept, "fetch" | "getBalances" | "getPayments" | "getPolicy" | "localPayments">;

export const tools = [
  {
    name: "pay_x402_request",
    title: "Pay an x402 request",
    description:
      "Make an HTTP request. If the server answers 402 Payment Required, pay it from the agent's Unslept account within its spending policy, then return the paid response.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Absolute http(s) URL." },
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], default: "GET" },
        headers: { type: "object", additionalProperties: { type: "string" } },
        body: { type: "string", description: "Request body, sent as is." },
        max_amount_usdg: { type: "string", description: "Refuse to pay more than this, in USDG, for example \"0.50\"." },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "get_balances",
    title: "Get balances",
    description: "Return the agent's liquid USDG, the amount working in tokenized assets, buffer debt and net balance.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_payment_history",
    title: "Get payment history",
    description: "Return recent x402 payments made by this agent: endpoint, amount, payee, fee and transaction hash.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 200, default: 20 } },
      additionalProperties: false,
    },
  },
  {
    name: "get_policy",
    title: "Get spending policy",
    description: "Return the agent's per-call cap, daily cap, amount left today, and whether it is paused or revoked.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
] as const;

const usdg = (v: bigint) => {
  const s = v.toString().padStart(7, "0");
  return `${s.slice(0, -6)}.${s.slice(-6)}`;
};

export function parseUsdg(s: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(s.trim());
  if (!m) throw new Error(`"${s}" is not a USDG amount. Use a decimal such as 0.50.`);
  return BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0"));
}

function toJson(v: unknown): Json {
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x))) as Json;
}

function result(data: unknown, isError = false) {
  const structured = toJson(data);
  return {
    content: [{ type: "text", text: JSON.stringify(structured, null, 2) }],
    structuredContent: structured,
    ...(isError ? { isError: true } : {}),
  };
}

export async function callTool(sdk: UnsleptLike, name: string, args: Record<string, unknown> = {}) {
  try {
    switch (name) {
      case "pay_x402_request": {
        const url = String(args.url ?? "");
        if (!/^https?:\/\//.test(url)) throw new Error("url must be an absolute http or https URL.");
        const before = sdk.localPayments().length;
        const res = await sdk.fetch(
          url,
          {
            method: (args.method as string) ?? "GET",
            headers: (args.headers as Record<string, string>) ?? undefined,
            body: (args.body as string) ?? undefined,
          },
          { maxAmount: args.max_amount_usdg ? parseUsdg(String(args.max_amount_usdg)) : undefined },
        );
        const text = await res.text();
        const paid = sdk.localPayments().slice(before);
        return result({
          status: res.status,
          contentType: res.headers.get("content-type"),
          body: text.length > MAX_BODY ? `${text.slice(0, MAX_BODY)}\n[truncated]` : text,
          payment: paid[0]
            ? {
                amountUsdg: usdg(paid[0].amount),
                feeUsdg: usdg(paid[0].fee),
                payee: paid[0].payee,
                scheme: paid[0].scheme,
                transactionHash: paid[0].transactionHash,
              }
            : null,
        });
      }
      case "get_balances": {
        const b = await sdk.getBalances();
        return result({ liquidUsdg: usdg(b.liquid), workingUsdg: usdg(b.working), debtUsdg: usdg(b.debt), netUsdg: usdg(b.net) });
      }
      case "get_payment_history": {
        const limit = Math.min(200, Math.max(1, Number(args.limit ?? 20)));
        const rows = await sdk.getPayments({ limit });
        return result(rows.map((r) => ({ ...r, amountUsdg: usdg(r.amount), feeUsdg: usdg(r.fee) })));
      }
      case "get_policy": {
        const p = await sdk.getPolicy();
        return result({
          perCallCapUsdg: usdg(p.perCallCap),
          dailyCapUsdg: usdg(p.dailyCap),
          remainingTodayUsdg: usdg(p.remainingToday),
          paused: p.paused,
          revoked: p.revoked,
        });
      }
      default:
        throw new Error(`Unknown tool ${name}.`);
    }
  } catch (e) {
    const err = e as Error & { code?: string };
    return result({ error: err.message, code: err.code ?? "ERROR" }, true);
  }
}

export async function handle(sdk: UnsleptLike, msg: RpcRequest): Promise<object | undefined> {
  const reply = (r: unknown) => ({ jsonrpc: "2.0", id: msg.id ?? null, result: r });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  const isNotification = msg.id === undefined;

  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(asked) ? asked : SUPPORTED_PROTOCOL_VERSIONS[0];
      return reply({
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Use pay_x402_request for any HTTP call that may need payment. Payments stay within the agent's on-chain spending policy.",
      });
    }
    case "notifications/initialized":
    case "notifications/cancelled":
      return undefined;
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      if (!tools.some((t) => t.name === name)) return fail(-32602, `Unknown tool: ${name}`);
      return reply(await callTool(sdk, name, (msg.params?.arguments as Record<string, unknown>) ?? {}));
    }
    default:
      return isNotification ? undefined : fail(-32601, `Method not found: ${msg.method}`);
  }
}

/** Runs the server over the given streams (stdin/stdout by default). Logs go to stderr only. */
export function serveStdio(sdk: UnsleptLike, input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout) {
  let buf = "";
  input.setEncoding?.("utf8");
  input.on("data", (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg: RpcRequest;
      try {
        msg = JSON.parse(line) as RpcRequest;
      } catch {
        output.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n");
        continue;
      }
      void handle(sdk, msg).then((r) => {
        if (r) output.write(JSON.stringify(r) + "\n");
      });
    }
  });
}
