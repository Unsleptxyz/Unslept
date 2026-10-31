"""Unslept Python SDK. Same surface as @unslept/sdk: fetch, get_balances, get_policy, set_policy,
get_payments, on_low_balance."""
from __future__ import annotations

import os
import secrets
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import IntEnum
from typing import Any, Callable, Optional, Protocol
from urllib.parse import urlparse

from .x402 import (
    EIP3009_TYPES,
    HEADER_RESPONSE,
    HEADER_SIGNATURE,
    SCHEME_EXACT,
    SCHEME_UNSLEPT,
    X402_VERSION,
    decode_header,
    encode_header,
    read_payment_required,
    select_requirement,
)


class SettlementMode(IntEnum):
    DIRECT = 0
    EXACT = 1


class UnsleptError(Exception):
    def __init__(self, code: str, message: str, **details: Any):
        super().__init__(message)
        self.code = code
        self.details = details


def fmt_usdg(v: int) -> str:
    whole, frac = divmod(abs(v), 10**6)
    f = str(frac).rjust(6, "0").rstrip("0")
    return f"{'-' if v < 0 else ''}{whole}{'.' + f if f else ''} USDG"


@dataclass
class Policy:
    per_call_cap: int
    daily_cap: int


@dataclass
class AccountState:
    policy: Policy
    remaining_today: int
    paused: bool
    revoked: bool
    liquid: int
    parked: int
    debt: int


@dataclass
class SettlementResult:
    transaction_hash: str
    fee: int
    buffer: str


@dataclass
class Payment:
    agent_id: str
    endpoint: str
    payee: str
    amount: int
    fee: int
    scheme: str
    transaction_hash: str
    payment_id: str
    settlement: Optional[dict] = None
    at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Balances:
    liquid: int
    working: int
    debt: int
    net: int


class Chain(Protocol):
    chain_id: int
    usdg: str

    def is_payee_allowed(self, payee: str, domain: str) -> bool: ...
    def get_account_state(self) -> AccountState: ...
    def request_payment(self, payee: str, amount: int, payment_id: str, domain: str, endpoint: str, mode: SettlementMode) -> SettlementResult: ...
    def set_policy(self, policy: Policy) -> str: ...
    def get_payments(self, limit: Optional[int] = None) -> list[dict]: ...


class Signer(Protocol):
    address: str

    def sign_typed_data(self, domain: dict, types: dict, primary_type: str, message: dict) -> str: ...


@dataclass
class HttpResponse:
    status: int
    headers: dict[str, str]
    body: bytes

    def header(self, name: str) -> Optional[str]:
        for k, v in self.headers.items():
            if k.lower() == name.lower():
                return v
        return None

    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")


Transport = Callable[[str, str, dict[str, str], Optional[bytes]], HttpResponse]


def urllib_transport(method: str, url: str, headers: dict[str, str], body: Optional[bytes]) -> HttpResponse:
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310 - caller-supplied URL is the point
            return HttpResponse(r.status, dict(r.headers.items()), r.read())
    except urllib.error.HTTPError as e:
        return HttpResponse(e.code, dict(e.headers.items()), e.read())


class Unslept:
    def __init__(
        self,
        agent_account: str,
        signer: Any = None,
        network: str = "robinhood-chain",
        chain: Optional[Chain] = None,
        transport: Transport = urllib_transport,
        schemes: Optional[list[str]] = None,
        on_payment: Optional[Callable[[Payment], None]] = None,
    ):
        if not agent_account or len(agent_account) != 42 or not agent_account.startswith("0x"):
            raise UnsleptError("CONFIG", "agent_account must be an AgentAccount address (0x followed by 40 hex characters).")
        self.agent_account = agent_account
        self.signer = signer
        self.network = network
        self._chain = chain
        self._transport = transport
        self._schemes = schemes or [SCHEME_UNSLEPT, SCHEME_EXACT]
        self._on_payment = on_payment
        self._log: list[Payment] = []
        self._low: list[tuple[int, Callable[[Balances], None]]] = []

    @property
    def chain(self) -> Chain:
        if self._chain is None:
            from .web3_chain import web3_chain_from_env

            self._chain = web3_chain_from_env(self.agent_account, self.signer, self.network)
        return self._chain

    # ------------------------------------------------------------------ fetch

    def fetch(self, url: str, method: str = "GET", headers: Optional[dict[str, str]] = None, body: Optional[bytes] = None,
              max_amount: Optional[int] = None) -> HttpResponse:
        """Drop-in HTTP call. Pays x402 paywalls from a balance that is always working."""
        headers = dict(headers or {})
        res = self._transport(method, url, headers, body)
        if res.status != 402:
            return res

        chain = self.chain
        pr = read_payment_required(res.headers)
        network = f"eip155:{chain.chain_id}"
        req = select_requirement(pr, network, chain.usdg, self._schemes)
        if req is None:
            offered = "; ".join(f"{a.get('scheme')} on {a.get('network')} in {a.get('asset')}" for a in pr["accepts"])
            raise UnsleptError("NO_MATCHING_REQUIREMENT",
                               f"The server does not accept USDG on {network} through {' or '.join(self._schemes)}. It offers: {offered}.")
        amount = int(req["amount"])
        if max_amount is not None and amount > max_amount:
            raise UnsleptError("MAX_AMOUNT", f"The server asks {fmt_usdg(amount)}, above the {fmt_usdg(max_amount)} limit set for this request.")
        domain = urlparse(url).hostname or ""
        self._check_policy(chain, req, amount, domain)

        exact = req["scheme"] == SCHEME_EXACT
        pid = (req.get("extra") or {}).get("paymentId")
        payment_id = pid if isinstance(pid, str) and len(pid) == 66 else "0x" + secrets.token_hex(32)
        s = chain.request_payment(req["payTo"], amount, payment_id, domain, url, SettlementMode.EXACT if exact else SettlementMode.DIRECT)

        payload = {
            "x402Version": X402_VERSION,
            "resource": pr.get("resource"),
            "accepted": req,
            "payload": self._sign_exact(chain, req, amount, payment_id) if exact else {
                "transaction": s.transaction_hash, "paymentId": payment_id, "agentAccount": self.agent_account},
        }
        if pr.get("extensions"):
            payload["extensions"] = pr["extensions"]
        headers[HEADER_SIGNATURE] = encode_header(payload)
        paid = self._transport(method, url, headers, body)

        raw = paid.header(HEADER_RESPONSE)
        sr = None
        if raw:
            try:
                sr = decode_header(raw)
            except Exception:  # noqa: BLE001
                sr = None
        record = Payment(self.agent_account, url, req["payTo"], amount, s.fee, req["scheme"],
                         (sr or {}).get("transaction") or s.transaction_hash, payment_id, sr)
        self._log.append(record)
        if self._on_payment:
            self._on_payment(record)
        self._check_low_balance()
        if paid.status == 402:
            raise UnsleptError("PAYMENT_REJECTED",
                               f"Paid {fmt_usdg(amount)} (transaction {s.transaction_hash}) but the server still answered 402. "
                               "Contact the merchant with the transaction hash.", record=record)
        return paid

    def _check_policy(self, chain: Chain, req: dict, amount: int, domain: str) -> None:
        st = chain.get_account_state()
        if st.revoked:
            raise UnsleptError("AGENT_REVOKED", "This agent was revoked by its owner. Create a new agent account to keep paying.")
        if st.paused:
            raise UnsleptError("AGENT_PAUSED", "This agent is paused. Its owner can resume it in the Unslept app.")
        if amount > st.policy.per_call_cap:
            raise UnsleptError("PER_CALL_CAP",
                               f"Payment of {fmt_usdg(amount)} is above the per-call cap of {fmt_usdg(st.policy.per_call_cap)}. "
                               "Raise the cap in the agent's spending policy to allow it.", amount=amount, cap=st.policy.per_call_cap)
        if amount > st.remaining_today:
            raise UnsleptError("DAILY_CAP", f"Payment of {fmt_usdg(amount)} would pass today's cap. "
                                            f"{fmt_usdg(st.remaining_today)} is left until 00:00 UTC.")
        if not chain.is_payee_allowed(req["payTo"], domain):
            raise UnsleptError("PAYEE_NOT_ALLOWED", f"Payee {req['payTo']} ({domain}) is not on this agent's allowlist. "
                                                    "Add the address or the domain in the agent's spending policy.")
        if amount + st.debt > st.liquid + st.parked:
            raise UnsleptError("INSUFFICIENT_COLLATERAL",
                               f"The agent holds {fmt_usdg(st.liquid + st.parked)} and owes {fmt_usdg(st.debt)}, "
                               f"not enough to cover {fmt_usdg(amount)}. Fund the agent account.")

    def _sign_exact(self, chain: Chain, req: dict, amount: int, nonce: str) -> dict:
        extra = req.get("extra") or {}
        if not self.signer or not hasattr(self.signer, "sign_typed_data"):
            raise UnsleptError("CONFIG", "The exact scheme needs a signer with sign_typed_data.")
        if not isinstance(extra.get("name"), str) or not isinstance(extra.get("version"), str):
            raise UnsleptError("CONFIG", "The server's exact requirement is missing extra.name or extra.version.")
        auth = {
            "from": self.signer.address,
            "to": req["payTo"],
            "value": str(amount),
            "validAfter": "0",
            "validBefore": str(int(time.time()) + int(req["maxTimeoutSeconds"])),
            "nonce": nonce,
        }
        sig = self.signer.sign_typed_data(
            {"name": extra["name"], "version": extra["version"], "chainId": chain.chain_id, "verifyingContract": req["asset"]},
            EIP3009_TYPES,
            "TransferWithAuthorization",
            {**auth, "value": amount, "validAfter": 0, "validBefore": int(auth["validBefore"])},
        )
        return {"signature": sig, "authorization": auth}

    # ------------------------------------------------------------------ reads

    def get_balances(self) -> Balances:
        s = self.chain.get_account_state()
        return Balances(s.liquid, s.parked, s.debt, s.liquid + s.parked - s.debt)

    def get_policy(self) -> dict:
        s = self.chain.get_account_state()
        return {"per_call_cap": s.policy.per_call_cap, "daily_cap": s.policy.daily_cap,
                "remaining_today": s.remaining_today, "paused": s.paused, "revoked": s.revoked}

    def set_policy(self, policy: Policy) -> str:
        return self.chain.set_policy(policy)

    def get_payments(self, limit: Optional[int] = None) -> list[dict]:
        return self.chain.get_payments(limit)

    def local_payments(self) -> list[Payment]:
        return list(self._log)

    def on_low_balance(self, callback: Callable[[Balances], None], threshold: int) -> Callable[[], None]:
        entry = (threshold, callback)
        self._low.append(entry)
        return lambda: self._low.remove(entry) if entry in self._low else None

    def _check_low_balance(self) -> None:
        if not self._low:
            return
        try:
            b = self.get_balances()
        except Exception:  # noqa: BLE001 - best effort
            return
        for threshold, cb in self._low:
            if b.net < threshold:
                cb(b)


def env(name: str) -> str:
    v = (os.environ.get(name) or "").strip()
    if not v:
        raise UnsleptError("CONFIG", f"{name} is not set. See .env.example for the Robinhood Chain settings.")
    return v
