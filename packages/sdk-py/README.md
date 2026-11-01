# unslept (Python)

Pay x402 paywalls in USDC on Solana from an Unslept agent account.

```sh
pip install "unslept[solana]"          # add ,langchain for the LangChain tool
```

```python
import os
from solders.keypair import Keypair
from unslept import Unslept

unslept = Unslept(
    os.environ["UNSLEPT_AGENT"],
    signer=Keypair.from_base58_string(os.environ["UNSLEPT_SIGNER_KEY"]),
    network="solana",
    rpc_url=os.environ.get("UNSLEPT_RPC_URL"),
)
res = unslept.fetch("https://api.example.com/data", max_amount=50_000)  # at most 0.05 USDC
print(res.status, res.text())
```

Also: `get_balances()`, `get_policy()`, `get_payments(limit)`, `local_payments()`, `on_low_balance(cb, threshold)`,
and `unslept.langchain_tool.unslept_tool(unslept)` for LangChain.

Docs: https://www.unslept.xyz/docs. MIT license.
