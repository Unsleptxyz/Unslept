# Agent templates

Starting points that run against Unslept on Solana mainnet. Each folder has its own README.

| Template | What it does |
|---|---|
| [research-agent](research-agent) | TypeScript agent that discovers paid APIs in the x402 Directory and pays for each call within a budget |
| [claude-mcp](claude-mcp) | Lets Claude Desktop (or any MCP client) pay x402 requests from its own agent account |
| [langchain-agent](langchain-agent) | Python LangChain agent with a paying fetch tool |
| [paid-api](paid-api) | For providers: a Next.js endpoint that charges agents per request with @unslept/pay |

Create the agent account and signer in the app at https://www.unslept.xyz/app, then copy the environment from the
Developers tab. Give every agent a small daily cap.
