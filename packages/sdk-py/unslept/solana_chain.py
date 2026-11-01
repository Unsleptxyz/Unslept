"""Solana implementation of the Chain protocol. Requires `pip install unslept[solana]` (solders).

Talks to Solana JSON-RPC with urllib and builds transactions with solders.
"""
from __future__ import annotations

import base64
import hashlib
import json
import struct
import time
import urllib.request
from typing import Any, Optional

from .client import AccountState, Policy, SettlementResult, UnsleptError

PROGRAM_ID = "HbAgL4w8R9D8RUEuK4rJknK5Vn8rBusfRtfTnFcYieue"
TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111"
SYSTEM_PROGRAM = "11111111111111111111111111111111"
NETWORKS = {
    "solana": {"caip2": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "usdc": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
               "rpc": "https://api.mainnet-beta.solana.com"},
    "solana-devnet": {"caip2": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", "usdc": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
                      "rpc": "https://api.devnet.solana.com"},
}
DISC_PAY = bytes([119, 18, 216, 65, 192, 117, 122, 220])
DISC_AGENT = bytes([47, 166, 112, 147, 155, 197, 86, 7])
DISC_CONFIG = bytes([155, 12, 170, 224, 30, 250, 204, 130])
DISC_SETTLED = bytes([232, 210, 40, 17, 142, 124, 145, 238])


def decode_agent(d: bytes) -> dict:
    from solders.pubkey import Pubkey

    if d[:8] != DISC_AGENT:
        raise UnsleptError("CONFIG", "account is not an Unslept agent")
    o = 8
    owner, signer = Pubkey.from_bytes(d[o:o + 32]), Pubkey.from_bytes(d[o + 32:o + 64])
    o += 64
    agent_id, per_call, daily, spent, day = struct.unpack_from("<QQQQq", d, o)
    o += 40
    paused, revoked = d[o] == 1, d[o + 1] == 1
    o += 2
    debt, position, payments = struct.unpack_from("<QQQ", d, o)
    o += 24
    n = d[o]
    o += 1
    allow = [str(Pubkey.from_bytes(d[o + 32 * i:o + 32 * (i + 1)])) for i in range(n)]
    return {"owner": str(owner), "signer": str(signer), "per_call_cap": per_call, "daily_cap": daily, "spent_today": spent,
            "spend_day": day, "paused": paused, "revoked": revoked, "debt": debt, "position_value": position, "allowlist": allow}


def decode_config(d: bytes) -> dict:
    from solders.pubkey import Pubkey

    if d[:8] != DISC_CONFIG:
        raise UnsleptError("CONFIG", "account is not the Unslept config")
    fee_bps = struct.unpack_from("<H", d, 104)[0]
    treasury = Pubkey.from_bytes(d[178:210])
    paused = d[8 + 96 + 106 * 2 + 16] == 1
    return {"fee_bps": fee_bps, "treasury": str(treasury), "paused": paused}


class SolanaChain:
    def __init__(self, agent: str, signer: Any, network: str = "solana", rpc_url: Optional[str] = None, program_id: str = PROGRAM_ID,
                 priority_fee: int = 10_000):
        from solders.pubkey import Pubkey

        if network not in NETWORKS:
            raise UnsleptError("CONFIG", f'Unknown network {network}. Use "solana" or "solana-devnet".')
        net = NETWORKS[network]
        self.network = net["caip2"]
        self.usdc = net["usdc"]
        self.rpc_url = rpc_url or net["rpc"]
        self.signer = signer
        self.priority_fee = priority_fee
        self.program = Pubkey.from_string(program_id)
        self.agent = Pubkey.from_string(agent)
        pda = lambda *s: Pubkey.find_program_address(list(s), self.program)[0]  # noqa: E731
        self.config = pda(b"config")
        self.buffer_vault = pda(b"buffer_vault")
        self.agent_vault = pda(b"agent_vault", bytes(self.agent))
        self._pda = pda

    def _rpc(self, method: str, params: list) -> Any:
        body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
        req = urllib.request.Request(self.rpc_url, data=body, headers={"content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310
            j = json.loads(r.read())
        if "error" in j:
            raise UnsleptError("SETTLEMENT_FAILED", f"RPC {method} failed: {j['error'].get('message')}", rpc_error=j["error"])
        return j["result"]

    def _account(self, address, what: str) -> bytes:
        v = self._rpc("getAccountInfo", [str(address), {"encoding": "base64", "commitment": "confirmed"}])["value"]
        if not v:
            raise UnsleptError("CONFIG", f"{what} {address} was not found on {self.network}.")
        if v["owner"] != str(self.program):
            raise UnsleptError("CONFIG", f"{what} {address} is not owned by the Unslept program.")
        return base64.b64decode(v["data"][0])

    def get_account_state(self) -> AccountState:
        a = decode_agent(self._account(self.agent, "Agent account"))
        today = int(time.time()) // 86_400
        spent = a["spent_today"] if a["spend_day"] == today else 0
        bal = self._rpc("getTokenAccountBalance", [str(self.agent_vault), {"commitment": "confirmed"}])
        return AccountState(Policy(a["per_call_cap"], a["daily_cap"]), max(0, a["daily_cap"] - spent), a["paused"], a["revoked"],
                            int(bal["value"]["amount"]), a["position_value"], a["debt"], a["allowlist"])

    def request_payment(self, payee: str, amount: int, payment_id: str, endpoint: str) -> SettlementResult:
        from solders.hash import Hash
        from solders.instruction import AccountMeta, Instruction
        from solders.message import Message
        from solders.pubkey import Pubkey
        from solders.transaction import Transaction

        cfg = decode_config(self._account(self.config, "Unslept config"))
        if cfg["paused"]:
            raise UnsleptError("SETTLEMENT_FAILED", "Unslept is paused. Payments resume when the protocol is unpaused.")
        pid = bytes.fromhex(payment_id.removeprefix("0x"))
        if len(pid) != 32:
            raise UnsleptError("CONFIG", "payment_id must be 32 bytes.")
        token, ata_prog, system = Pubkey.from_string(TOKEN_PROGRAM), Pubkey.from_string(ATA_PROGRAM), Pubkey.from_string(SYSTEM_PROGRAM)
        usdc, payee_pk, me = Pubkey.from_string(self.usdc), Pubkey.from_string(payee), self.signer.pubkey()
        payee_token = Pubkey.find_program_address([bytes(payee_pk), bytes(token), bytes(usdc)], ata_prog)[0]
        payment = self._pda(b"payment", pid)
        cb = Pubkey.from_string(COMPUTE_BUDGET)
        ixs = [
            Instruction(cb, bytes([2]) + struct.pack("<I", 120_000), []),
            Instruction(cb, bytes([3]) + struct.pack("<Q", self.priority_fee), []),
            Instruction(ata_prog, bytes([1]), [
                AccountMeta(me, True, True), AccountMeta(payee_token, False, True), AccountMeta(payee_pk, False, False),
                AccountMeta(usdc, False, False), AccountMeta(system, False, False), AccountMeta(token, False, False)]),
            Instruction(self.program, DISC_PAY + pid + struct.pack("<Q", amount) + hashlib.sha256(endpoint.encode()).digest(), [
                AccountMeta(me, True, True), AccountMeta(self.config, False, True), AccountMeta(self.agent, False, True),
                AccountMeta(self.agent_vault, False, True), AccountMeta(self.buffer_vault, False, True),
                AccountMeta(Pubkey.from_string(cfg["treasury"]), False, True), AccountMeta(payee_token, False, True),
                AccountMeta(payment, False, True), AccountMeta(token, False, False), AccountMeta(system, False, False)]),
        ]
        bh = self._rpc("getLatestBlockhash", [{"commitment": "confirmed"}])["value"]["blockhash"]
        tx = Transaction([self.signer], Message(ixs, me), Hash.from_string(bh))
        try:
            sig = self._rpc("sendTransaction", [base64.b64encode(bytes(tx)).decode(), {"encoding": "base64", "preflightCommitment": "confirmed"}])
        except UnsleptError as e:
            msg = str(e.details.get("rpc_error", e))
            for pat, code in (("InsufficientLiquidity", "INSUFFICIENT_BUFFER_LIQUIDITY"), ("InsufficientCollateral", "INSUFFICIENT_COLLATERAL"),
                              ("PerCallCapExceeded", "PER_CALL_CAP"), ("DailyCapExceeded", "DAILY_CAP"), ("PayeeNotAllowed", "PAYEE_NOT_ALLOWED")):
                if pat in msg:
                    raise UnsleptError(code, f"Settlement failed: {msg}") from e
            raise
        for _ in range(60):
            st = self._rpc("getSignatureStatuses", [[sig]])["value"][0]
            if st and st.get("confirmationStatus") in ("confirmed", "finalized"):
                if st.get("err"):
                    raise UnsleptError("SETTLEMENT_FAILED", f"Settlement failed: {st['err']}")
                break
            time.sleep(1)
        else:
            raise UnsleptError("SETTLEMENT_FAILED", f"Transaction {sig} was not confirmed in time.")
        return SettlementResult(sig, amount * cfg["fee_bps"] // 10_000, str(payment))

    def get_payments(self, limit: Optional[int] = None) -> list[dict]:
        sigs = self._rpc("getSignaturesForAddress", [str(self.agent), {"limit": limit or 20, "commitment": "confirmed"}])
        out = []
        for s in sigs:
            if s.get("err"):
                continue
            tx = self._rpc("getTransaction", [s["signature"], {"encoding": "json", "maxSupportedTransactionVersion": 0, "commitment": "confirmed"}])
            for line in ((tx or {}).get("meta") or {}).get("logMessages") or []:
                if not line.startswith("Program data: "):
                    continue
                d = base64.b64decode(line[14:])
                if d[:8] != DISC_SETTLED:
                    continue
                from solders.pubkey import Pubkey

                amount, fee = struct.unpack_from("<QQ", d, 104)
                out.append({"payment_id": "0x" + d[8:40].hex(), "payee": str(Pubkey.from_bytes(d[72:104])), "amount": amount, "fee": fee,
                            "transaction": s["signature"], "slot": s["slot"], "timestamp": s.get("blockTime")})
        return out
