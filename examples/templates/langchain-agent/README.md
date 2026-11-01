# LangChain agent

A tool-calling LangChain agent that can pay x402 endpoints from an Unslept agent account.

```sh
pip install -r requirements.txt
export UNSLEPT_AGENT=<agent account address> UNSLEPT_SIGNER_KEY=<signer secret key, base58> OPENAI_API_KEY=...
export UNSLEPT_RPC_URL=https://api.mainnet-beta.solana.com
python agent.py
```

Any chat model with tool calling works in place of OpenAI.
