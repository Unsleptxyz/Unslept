# @unslept/mcp

An MCP server (stdio) that lets a model pay x402 requests from an Unslept agent account, inside the account's
on-chain spending policy.

Tools: `pay_x402_request`, `get_balances`, `get_payment_history`, `get_policy`.

```json
{
  "mcpServers": {
    "unslept": {
      "command": "npx",
      "args": ["-y", "@unslept/mcp"],
      "env": {
        "UNSLEPT_AGENT_ACCOUNT": "0x...",
        "UNSLEPT_SIGNER_KEY": "0x...",
        "UNSLEPT_NETWORK": "robinhood-chain",
        "UNSLEPT_CHAIN_ID": "4663",
        "UNSLEPT_RPC_URL": "https://rpc.mainnet.chain.robinhood.com",
        "UNSLEPT_USDG": "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
        "UNSLEPT_ROUTER": "0x1FeAB3B8f88FB0667B686fDCB0206194e88c984b",
        "UNSLEPT_BUFFERS": "0xcD853fb30eCe3134Cf21e2f47B9e23eaf965F40D"
      }
    }
  }
}
```

`UNSLEPT_SIGNER_KEY` is the agent's signing key, not the owner wallet. The owner sets caps and can pause or
revoke the agent at any time.

Unslept is experimental software on a guarded, unaudited mainnet launch. Yield is variable and not guaranteed. Give each agent a small daily cap.
