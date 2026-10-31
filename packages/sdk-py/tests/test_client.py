import json
import unittest

from unslept import Policy, SettlementMode, Unslept, UnsleptError, decode_header, encode_header
from unslept.client import AccountState, HttpResponse, SettlementResult
from unslept.langchain_tool import pay_x402_request

USDG = "0x00000000000000000000000000000000000000aa"
PAYEE = "0x00000000000000000000000000000000000000bb"
AGENT = "0x00000000000000000000000000000000000000cc"


class FakeChain:
    chain_id = 4242
    usdg = USDG

    def __init__(self):
        self.calls = []
        self.allowed = {PAYEE}
        self.state = AccountState(Policy(5_000_000, 20_000_000), 20_000_000, False, False, 0, 100_000_000, 0)

    def is_payee_allowed(self, payee, domain):
        return payee in self.allowed or domain in self.allowed

    def get_account_state(self):
        return self.state

    def request_payment(self, payee, amount, payment_id, domain, endpoint, mode):
        self.calls.append((payee, amount, payment_id, domain, endpoint, mode))
        return SettlementResult("0x" + "11" * 32, amount // 1000, USDG)

    def set_policy(self, policy):
        return "0x" + "22" * 32

    def get_payments(self, limit=None):
        return []


def paywall(price, schemes=("unslept-direct",)):
    seen = []

    def transport(method, url, headers, body):
        seen.append(dict(headers))
        if "PAYMENT-SIGNATURE" not in headers:
            pr = {"x402Version": 2, "resource": {"url": url}, "accepts": [
                {"scheme": s, "network": "eip155:4242", "amount": price, "asset": USDG, "payTo": PAYEE, "maxTimeoutSeconds": 60,
                 "extra": {"name": "Global Dollar", "version": "2"} if s == "exact" else {"paymentId": "0x" + "ab" * 32}}
                for s in schemes]}
            return HttpResponse(402, {"PAYMENT-REQUIRED": encode_header(pr)}, b"{}")
        sr = encode_header({"success": True, "transaction": "0x" + "11" * 32, "network": "eip155:4242"})
        return HttpResponse(200, {"PAYMENT-RESPONSE": sr}, b'{"ok":true}')

    return transport, seen


class ClientTest(unittest.TestCase):
    def test_pays_and_retries(self):
        chain = FakeChain()
        t, seen = paywall("1000000")
        u = Unslept(AGENT, chain=chain, transport=t)
        r = u.fetch("https://api.example.com/data")
        self.assertEqual(r.status, 200)
        self.assertEqual(chain.calls[0][2], "0x" + "ab" * 32)
        self.assertEqual(chain.calls[0][5], SettlementMode.DIRECT)
        sent = decode_header(seen[1]["PAYMENT-SIGNATURE"])
        self.assertEqual(sent["x402Version"], 2)
        self.assertEqual(sent["payload"]["agentAccount"], AGENT)
        p = u.local_payments()[0]
        self.assertEqual((p.endpoint, p.amount, p.payee), ("https://api.example.com/data", 1_000_000, PAYEE))

    def test_per_call_cap(self):
        chain = FakeChain()
        u = Unslept(AGENT, chain=chain, transport=paywall("6000000")[0])
        with self.assertRaises(UnsleptError) as cm:
            u.fetch("https://api.example.com/data")
        self.assertEqual(cm.exception.code, "PER_CALL_CAP")
        self.assertIn("6 USDG is above the per-call cap of 5 USDG", str(cm.exception))
        self.assertEqual(chain.calls, [])

    def test_empty_wallet(self):
        chain = FakeChain()
        chain.state.parked = 0
        u = Unslept(AGENT, chain=chain, transport=paywall("1000000")[0])
        with self.assertRaises(UnsleptError) as cm:
            u.fetch("https://api.example.com/data")
        self.assertEqual(cm.exception.code, "INSUFFICIENT_COLLATERAL")

    def test_allowlist_and_daily_cap(self):
        chain = FakeChain()
        chain.allowed = set()
        u = Unslept(AGENT, chain=chain, transport=paywall("1000000")[0])
        with self.assertRaises(UnsleptError) as cm:
            u.fetch("https://api.example.com/data")
        self.assertEqual(cm.exception.code, "PAYEE_NOT_ALLOWED")
        chain.allowed = {"api.example.com"}
        chain.state.remaining_today = 10
        with self.assertRaises(UnsleptError) as cm:
            u.fetch("https://api.example.com/data")
        self.assertEqual(cm.exception.code, "DAILY_CAP")

    def test_exact_scheme_signs_eip3009(self):
        chain = FakeChain()
        captured = {}

        class S:
            address = "0x00000000000000000000000000000000000000dd"

            def sign_typed_data(self, domain, types, primary_type, message):
                captured.update(domain=domain, primary=primary_type, message=message)
                return "0x" + "33" * 65

        t, seen = paywall("2500000", ("exact",))
        Unslept(AGENT, signer=S(), chain=chain, transport=t).fetch("https://api.example.com/data")
        self.assertEqual(chain.calls[0][5], SettlementMode.EXACT)
        self.assertEqual(captured["primary"], "TransferWithAuthorization")
        self.assertEqual(captured["domain"]["chainId"], 4242)
        self.assertEqual(captured["message"]["to"], PAYEE)
        self.assertEqual(captured["message"]["nonce"], chain.calls[0][2])
        sent = decode_header(seen[1]["PAYMENT-SIGNATURE"])
        self.assertEqual(sent["payload"]["authorization"]["value"], "2500000")

    def test_low_balance_and_tool(self):
        chain = FakeChain()
        chain.state.parked = 1_500_000
        u = Unslept(AGENT, chain=chain, transport=paywall("1000000")[0])
        fired = []
        u.on_low_balance(fired.append, threshold=2_000_000)
        out = json.loads(pay_x402_request(u, "https://api.example.com/data", max_amount_usdg="2"))
        self.assertEqual(out["status"], 200)
        self.assertEqual(out["payment"]["amount"], "1 USDG")
        self.assertEqual(len(fired), 1)
        over = json.loads(pay_x402_request(u, "https://api.example.com/data", max_amount_usdg="0.5"))
        self.assertEqual(over["code"], "MAX_AMOUNT")

    def test_bad_config(self):
        with self.assertRaises(UnsleptError):
            Unslept("nope")


if __name__ == "__main__":
    unittest.main()
