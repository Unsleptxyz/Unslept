# unslept

Pay x402 paywalls from an Unslept agent account on Robinhood Chain, from Python.

```sh
pip install "unslept[web3]"            # add [langchain] for the LangChain tool
```

```python
import os
from eth_account import Account
from unslept import Unslept
from unslept.web3_chain import EthAccountSigner

unslept = Unslept(
    agent_account=os.environ["UNSLEPT_AGENT_ACCOUNT"],
    signer=EthAccountSigner(Account.from_key(os.environ["UNSLEPT_SIGNER_KEY"])),
    network="robinhood-chain",
)
res = unslept.fetch("https://example.com/paid-resource")
print(res.status, res.text())
```

LangChain: `from unslept.langchain_tool import unslept_tool` and add `unslept_tool(unslept)` to your agent's tools.

## Configuration

```sh
# Robinhood Chain mainnet. Addresses are published in contracts/deployments/4663.json.
UNSLEPT_CHAIN_ID=4663
UNSLEPT_RPC_URL=https://rpc.mainnet.chain.robinhood.com
UNSLEPT_USDG=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168
UNSLEPT_ROUTER=0x1FeAB3B8f88FB0667B686fDCB0206194e88c984b
UNSLEPT_BUFFERS=0xcD853fb30eCe3134Cf21e2f47B9e23eaf965F40D
```

Unslept is experimental software on a guarded, unaudited mainnet launch. Yield is variable and not guaranteed. Give each agent a small daily cap.
