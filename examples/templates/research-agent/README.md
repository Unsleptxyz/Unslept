# Research agent

Discovers paid APIs in the [x402 Directory](https://www.unslept.xyz/directory) and calls each one, paying per request
from your Unslept agent account. It stops at a budget you set and never pays more than the listed price.

```sh
cp .env.example .env   # fill in your agent account and signer key
npm install
npm start
```

Your on-chain policy still applies: the account's per-call and daily caps are enforced by the contract, whatever this
script does.
