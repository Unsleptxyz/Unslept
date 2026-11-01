"""Unslept Python SDK for Solana. Same surface as @unslept/sdk: fetch, get_balances, get_policy, get_payments,
on_low_balance."""
from __future__ import annotations

import os
import secrets
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Optional, Protocol

from .x402 import (
    HEADER_RESPONSE,
    HEADER_SIGNATURE,
    SCHEME_UNSLEPT,
    X402_VERSION,
    decode_header,
    encode_header,
    read_payment_required,
    select_requirement,
)


class UnsleptError(Exception):
    def __init__(self, code: str, message: str, **details: Any):
        super().__init__(message)
        self.code = code
        self.details = details


def fmt_usdc(v: int) -> str:
    whole, frac = divmod(abs(v), 10**6)
    f = str(frac).rjust(6, "0").rstrip("0")
    return f"{'-' if v < 0 else ''}{whole}{'.' + f if f else ''} USDC"


_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def is_solana_address(v: Any) -> bool:
    if not isinstance(v, str) or not 32 <= len(v) <= 44 or any(c not in _B58 for c in v):
        return False
    n = 0
    for c in v:
        n = n * 58 + _B58.index(c)
    lead = len(v) - len(v.lstrip("1"))
    return lead + (n.bit_length() + 7) // 8 == 32


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
    allowlist: list[str] = field(default_factory=list)


@dataclass
class SettlementResult:
    transaction: str
    fee: int
    payment: str


@dataclass
class Payment:
    agent: str
    endpoint: str
    payee: str
    amount: int
    fee: int
    scheme: str
    transaction: str
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
    network: str  # CAIP-2
    usdc: str  # mint

    def get_account_state(self) -> AccountState: ...
    def request_payment(self, payee: str, amount: int, payment_id: str, endpoint: str) -> SettlementResult: ...
    def get_payments(self, limit: Optional[int] = None) -> list[dict]: ...


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
        agent: str,
        signer: Any = None,
        network: str = "solana",
        rpc_url: Optional[str] = None,
        chain: Optional[Chain] = None,
        transport: Transport = urllib_transport,
        on_payment: Optional[Callable[[Payment], None]] = None,
    ):
        if not is_solana_address(agent):
            raise UnsleptError("CONFIG", "agent must be an Unslept agent account address (base58).")
        self.agent = agent
        self.signer = signer
        self.network = network
        self.rpc_url = rpc_url
        self._chain = chain
        self._transport = transport
        self._on_payment = on_payment
        self._log: list[Payment] = []
        self._low: list[tuple[int, Callable[[Balances], None]]] = []

    @property
    def chain(self) -> Chain:
        if self._chain is None:
            from .solana_chain import SolanaChain

            if self.signer is None:
                raise UnsleptError("CONFIG", "signer is required: pass the agent signer (a solders Keypair).")
            self._chain = SolanaChain(self.agent, self.signer, self.network, self.rpc_url)
        return self._chain

    # ------------------------------------------------------------------ fetch

    def fetch(self, url: str, method: str = "GET", headers: Optional[dict[str, str]] = None, body: Optional[bytes] = None,
              max_amount: Optional[int] = None) -> HttpResponse:
        """Drop-in HTTP call. Pays x402 paywalls in USDC on Solana from a balance that keeps earning."""
        headers = dict(headers or {})
        res = self._transport(method, url, headers, body)
        if res.status != 402:
            return res

        chain = self.chain
        pr = read_payment_required(res.headers)
        req = select_requirement(pr, chain.network, chain.usdc, [SCHEME_UNSLEPT])
        if req is None:
            offered = "; ".join(f"{a.get('scheme')} on {a.get('network')} in {a.get('asset')}" for a in pr["accepts"])
            raise UnsleptError("NO_MATCHING_REQUIREMENT",
                               f"The server does not accept USDC on {chain.network} through {SCHEME_UNSLEPT}. It offers: {offered}.")
        amount = int(req["amount"])
        if max_amount is not None and amount > max_amount:
            raise UnsleptError("MAX_AMOUNT", f"The server asks {fmt_usdc(amount)}, above the {fmt_usdc(max_amount)} limit set for this request.")
        self._check_policy(chain, req, amount)

        pid = (req.get("extra") or {}).get("paymentId")
        payment_id = pid if isinstance(pid, str) and len(pid) == 66 else "0x" + secrets.token_hex(32)
        s = chain.request_payment(req["payTo"], amount, payment_id, url)

        payload = {
            "x402Version": X402_VERSION,
            "resource": pr.get("resource"),
            "accepted": req,
            "payload": {"transaction": s.transaction, "paymentId": payment_id, "agent": self.agent, "payment": s.payment},
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
        record = Payment(self.agent, url, req["payTo"], amount, s.fee, req["scheme"], s.transaction, payment_id, sr)
        self._log.append(record)
        if self._on_payment:
            self._on_payment(record)
        self._check_low_balance()
        if paid.status == 402:
            raise UnsleptError("PAYMENT_REJECTED",
                               f"Paid {fmt_usdc(amount)} (transaction {s.transaction}) but the server still answered 402. "
                               "Contact the merchant with the transaction signature.", record=record)
        return paid

    def _check_policy(self, chain: Chain, req: dict, amount: int) -> None:
        st = chain.get_account_state()
        if st.revoked:
            raise UnsleptError("AGENT_REVOKED", "This agent was revoked by its owner. Create a new agent account to keep paying.")
        if st.paused:
            raise UnsleptError("AGENT_PAUSED", "This agent is paused. Its owner can resume it in the Unslept app.")
        if amount > st.policy.per_call_cap:
            raise UnsleptError("PER_CALL_CAP",
                               f"Payment of {fmt_usdc(amount)} is above the per-call cap of {fmt_usdc(st.policy.per_call_cap)}. "
                               "Raise the cap in the agent's spending policy to allow it.", amount=amount, cap=st.policy.per_call_cap)
        if amount > st.remaining_today:
            raise UnsleptError("DAILY_CAP", f"Payment of {fmt_usdc(amount)} would pass today's cap. "
                                            f"{fmt_usdc(st.remaining_today)} is left until 00:00 UTC.")
        if st.allowlist and req["payTo"] not in st.allowlist:
            raise UnsleptError("PAYEE_NOT_ALLOWED", f"Payee {req['payTo']} is not on this agent's allowlist. "
                                                    "Add the wallet in the agent's spending policy.")
        if amount + st.debt > st.liquid + st.parked * 95 // 100:
            raise UnsleptError("INSUFFICIENT_COLLATERAL",
                               f"The agent holds {fmt_usdc(st.liquid + st.parked)} and owes {fmt_usdc(st.debt)}, "
                               f"not enough to cover {fmt_usdc(amount)}. Fund the agent account.")

    # ------------------------------------------------------------------ reads

    def get_balances(self) -> Balances:
        s = self.chain.get_account_state()
        return Balances(s.liquid, s.parked, s.debt, s.liquid + s.parked - s.debt)

    def get_policy(self) -> dict:
        s = self.chain.get_account_state()
        return {"per_call_cap": s.policy.per_call_cap, "daily_cap": s.policy.daily_cap,
                "remaining_today": s.remaining_today, "paused": s.paused, "revoked": s.revoked, "allowlist": s.allowlist}

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
        raise UnsleptError("CONFIG", f"{name} is not set. See the Unslept docs.")
    return v
