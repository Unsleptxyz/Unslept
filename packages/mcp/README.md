# @unslept/mcp

MCP server that lets any MCP client pay x402 requests in USDC on Solana from an Unslept agent account.

```json
{
  "mcpServers": {
    "unslept": {
      "command": "npx",
      "args": ["-y", "@unslept/mcp"],
      "env": {
        "UNSLEPT_AGENT": "<agent account address>",
        "UNSLEPT_SIGNER_KEY": "<agent signer secret key, base58 or JSON array>",
        "UNSLEPT_NETWORK": "solana",
        "UNSLEPT_RPC_URL": "<your Solana RPC URL>"
      }
    }
  }
}
```

Tools: `pay_x402_request` (optional `max_amount_usdc`), `get_balances`, `get_payment_history`, `get_policy`.
Payments always stay inside the agent's on-chain spending policy.

Docs: https://www.unslept.xyz/docs/mcp. MIT license.
