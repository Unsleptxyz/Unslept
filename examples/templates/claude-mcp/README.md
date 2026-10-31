# Claude Desktop with a paying agent account

Gives Claude Desktop, or any MCP client, tools to pay x402 requests from its own Unslept agent account.

1. Create an agent account in the app and set a small daily cap.
2. Open Claude Desktop settings, then Developer, then Edit Config, and merge `claude_desktop_config.json` from this folder.
3. Fill in `UNSLEPT_AGENT_ACCOUNT` and `UNSLEPT_SIGNER_KEY`, then restart Claude Desktop.

Try: "List the paid APIs in https://www.unslept.xyz/api/directory and call the protocol snapshot endpoint."
Claude asks before each paid call, and the contract enforces your caps.
