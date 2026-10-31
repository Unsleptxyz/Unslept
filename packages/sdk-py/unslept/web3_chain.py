"""web3.py implementation of the Chain protocol. Requires `pip install unslept[web3]`."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from .client import AccountState, Policy, SettlementMode, SettlementResult, UnsleptError, env

_ABI_DIR = Path(__file__).parent / "abi"


def _abi(name: str) -> list:
    return json.loads((_ABI_DIR / f"{name}.json").read_text())


class Web3Chain:
    def __init__(self, w3: Any, agent_account: str, usdg: str, router: str, buffers: list[str], account: Any,
                 from_block: int = 0):
        self.w3 = w3
        self.chain_id = w3.eth.chain_id
        self.usdg = usdg
        self.account = account
        self.agent = w3.eth.contract(address=w3.to_checksum_address(agent_account), abi=_abi("AgentAccount"))
        self.router = w3.eth.contract(address=w3.to_checksum_address(router), abi=_abi("SettlementRouter"))
        self.buffers = [w3.eth.contract(address=w3.to_checksum_address(b), abi=_abi("UnsleptBuffer")) for b in buffers]
        self.from_block = from_block

    def is_payee_allowed(self, payee: str, domain: str) -> bool:
        return self.agent.functions.isPayeeAllowed(self.w3.to_checksum_address(payee), domain).call()

    def get_account_state(self) -> AccountState:
        f = self.agent.functions
        per_call, daily = f.policy().call()
        debt = sum(b.functions.debtOf(self.agent.address).call() for b in self.buffers)
        return AccountState(Policy(per_call, daily), f.remainingToday().call(), f.paused().call(), f.revoked().call(),
                            f.liquid().call(), f.parkedValue().call(), debt)

    def _send(self, fn: Any) -> Any:
        tx = fn.build_transaction({"from": self.account.address, "nonce": self.w3.eth.get_transaction_count(self.account.address)})
        signed = self.account.sign_transaction(tx)
        raw = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction")
        h = self.w3.eth.send_raw_transaction(raw)
        receipt = self.w3.eth.wait_for_transaction_receipt(h)
        if receipt.status != 1:
            raise UnsleptError("SETTLEMENT_FAILED", f"Transaction {h.hex()} reverted.")
        return receipt

    def request_payment(self, payee: str, amount: int, payment_id: str, domain: str, endpoint: str,
                        mode: SettlementMode) -> SettlementResult:
        req = (self.w3.to_checksum_address(payee), amount, bytes.fromhex(payment_id[2:]), domain, endpoint, int(mode))
        fn = self.agent.functions.requestPayment(req)
        try:
            fn.call({"from": self.account.address})  # surface policy reverts before sending
        except Exception as e:  # noqa: BLE001
            raise UnsleptError("SETTLEMENT_FAILED", f"Settlement would revert: {e}") from e
        receipt = self._send(fn)
        events = self.router.events.Settled().process_receipt(receipt)
        if not events:
            raise UnsleptError("SETTLEMENT_FAILED", "Transaction has no Settled event.")
        a = events[0]["args"]
        return SettlementResult(receipt.transactionHash.hex(), a["fee"], a["buffer"])

    def set_policy(self, policy: Policy) -> str:
        receipt = self._send(self.agent.functions.setPolicy((policy.per_call_cap, policy.daily_cap)))
        return receipt.transactionHash.hex()

    def get_payments(self, limit: Optional[int] = None) -> list[dict]:
        logs = self.router.events.Settled().get_logs(from_block=self.from_block, argument_filters={"agent": self.agent.address})
        rows = [{"payment_id": "0x" + l["args"]["paymentId"].hex(), "payee": l["args"]["payee"], "amount": l["args"]["amount"],
                 "fee": l["args"]["fee"], "endpoint": l["args"]["endpoint"], "transaction_hash": l["transactionHash"].hex(),
                 "block_number": l["blockNumber"]} for l in logs]
        rows.reverse()
        return rows[:limit] if limit else rows


def web3_chain_from_env(agent_account: str, signer: Any, network: str) -> Web3Chain:
    if network != "robinhood-chain":
        raise UnsleptError("CONFIG", f'Unknown network preset "{network}". Pass a chain implementation instead.')
    try:
        from web3 import Web3
    except ImportError as e:
        raise UnsleptError("CONFIG", "web3 is not installed. Run: pip install 'unslept[web3]'") from e
    w3 = Web3(Web3.HTTPProvider(env("UNSLEPT_RPC_URL")))
    if w3.eth.chain_id != int(env("UNSLEPT_CHAIN_ID")):
        raise UnsleptError("CONFIG", "UNSLEPT_RPC_URL points at a different chain than UNSLEPT_CHAIN_ID.")
    return Web3Chain(w3, agent_account, env("UNSLEPT_USDG"), env("UNSLEPT_ROUTER"),
                     [b.strip() for b in env("UNSLEPT_BUFFERS").split(",")], signer)


class EthAccountSigner:
    """Adapts an eth_account LocalAccount to the SDK signer interface (needed for the exact scheme)."""

    def __init__(self, account: Any):
        self.account = account
        self.address = account.address

    def sign_typed_data(self, domain: dict, types: dict, primary_type: str, message: dict) -> str:
        signed = self.account.sign_typed_data(domain_data=domain, message_types=types, message_data=message)
        sig = signed.signature.hex()
        return sig if sig.startswith("0x") else "0x" + sig

    def sign_transaction(self, tx: dict) -> Any:
        return self.account.sign_transaction(tx)
