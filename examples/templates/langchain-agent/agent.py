"""LangChain agent with a tool that pays x402 requests from an Unslept agent account."""
import os

from eth_account import Account
from langchain.agents import create_agent

from unslept import Unslept
from unslept.langchain_tool import unslept_tool
from unslept.web3_chain import EthAccountSigner

unslept = Unslept(
    agent_account=os.environ["UNSLEPT_AGENT_ACCOUNT"],
    signer=EthAccountSigner(Account.from_key(os.environ["UNSLEPT_SIGNER_KEY"])),
    network="robinhood-chain",
)

agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=[unslept_tool(unslept)],
    system_prompt=(
        "You can call paid HTTP APIs with the pay_x402_request tool. "
        "Paid endpoints are listed at https://www.unslept.xyz/api/directory. Spend as little as possible."
    ),
)

if __name__ == "__main__":
    result = agent.invoke({"messages": [{"role": "user", "content": "Get the live Unslept protocol snapshot and summarize it in two sentences."}]})
    print(result["messages"][-1].content)
