import json
import unittest

from unslept import Policy, Unslept, UnsleptError, decode_header, encode_header, is_solana_address
from unslept.client import AccountState, HttpResponse, SettlementResult
from unslept.langchain_tool import pay_x402_request

NET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
PAYEE = "7DNkxPNsu6hYKpwgHsVXgtnR4twnXKEUbffGDsWMM37Z"
AGENT = "HCdAT1i8DC1FKwsKsaKtpnLwzqWjjuLFSGMMpFyVxvv1"


class FakeChain:
    network = NET
    usdc = USDC

    def __init__(self):
        self.calls = []
        self.state = AccountState(Policy(5_000_000, 20_000_000), 20_000_000, False, False, 0, 100_000_000, 0, [])

    def get_account_state(self):
        return self.state

    def request_payment(self, payee, amount, payment_id, endpoint):
        self.calls.append((payee, amount, payment_id, endpoint))
        return SettlementResult("5sig", amount // 1000, "PaymentRecord1111111111111111111111111111111")

    def get_payments(self, limit=None):
        return []


def paywall(price, network=NET):
    seen = []

    def transport(method, url, headers, body):
        seen.append(dict(headers))
        if "PAYMENT-SIGNATURE" not in headers:
            pr = {"x402Version": 2, "resource": {"url": url}, "accepts": [
                {"scheme": "unslept-direct", "network": network, "amount": price, "asset": USDC, "payTo": PAYEE, "maxTimeoutSeconds": 60,
                 "extra": {"paymentId": "0x" + "ab" * 32}}]}
            return HttpResponse(402, {"PAYMENT-REQUIRED": encode_header(pr)}, b"{}")
        sr = encode_header({"success": True, "transaction": "5sig", "network": network})
        return HttpResponse(200, {"PAYMENT-RESPONSE": sr}, b'{"ok":true}')

    return transport, seen


class ClientTest(unittest.TestCase):
    def test_address_check(self):
        self.assertTrue(is_solana_address(AGENT))
        self.assertFalse(is_solana_address("0x00000000000000000000000000000000000000cc"))

    def test_pays_and_retries(self):
        chain = FakeChain()
        t, seen = paywall("1000000")
        u = Unslept(AGENT, chain=chain, transport=t)
        r = u.fetch("https://api.example.com/data")
        self.assertEqual(r.status, 200)
        self.assertEqual(chain.calls[0][2], "0x" + "ab" * 32)
        sent = decode_header(seen[1]["PAYMENT-SIGNATURE"])
        self.assertEqual(sent["x402Version"], 2)
        self.assertEqual(sent["payload"]["agent"], AGENT)
        self.assertEqual(sent["payload"]["transaction"], "5sig")
        p = u.local_payments()[0]
        self.assertEqual((p.endpoint, p.amount, p.payee), ("https://api.example.com/data", 1_000_000, PAYEE))

    def test_other_network_refused(self):
        u = Unslept(AGENT, chain=FakeChain(), transport=paywall("1000", "eip155:1")[0])
        with self.assertRaises(UnsleptError) as cm:
            u.fetch("https://api.example.com/data")
        self.assertEqual(cm.exception.code, "NO_MATCHING_REQUIREMENT")

    def test_per_call_cap(self):
        chain = FakeChain()
        u = Unslept(AGENT, chain=chain, transport=paywall("6000000")[0])
        with self.assertRaises(UnsleptError) as cm:
            u.fetch("https://api.example.com/data")
        self.assertEqual(cm.exception.code, "PER_CALL_CAP")
        self.assertIn("6 USDC is above the per-call cap of 5 USDC", str(cm.exception))
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
        chain.state.allowlist = [AGENT]
        u = Unslept(AGENT, chain=chain, transport=paywall("1000000")[0])
        with self.assertRaises(UnsleptError) as cm:
            u.fetch("https://api.example.com/data")
        self.assertEqual(cm.exception.code, "PAYEE_NOT_ALLOWED")
        chain.state.allowlist = [PAYEE]
        chain.state.remaining_today = 10
        with self.assertRaises(UnsleptError) as cm:
            u.fetch("https://api.example.com/data")
        self.assertEqual(cm.exception.code, "DAILY_CAP")

    def test_low_balance_and_tool(self):
        chain = FakeChain()
        chain.state.parked = 1_500_000
        u = Unslept(AGENT, chain=chain, transport=paywall("1000000")[0])
        fired = []
        u.on_low_balance(fired.append, threshold=2_000_000)
        out = json.loads(pay_x402_request(u, "https://api.example.com/data", max_amount_usdc="2"))
        self.assertEqual(out["status"], 200)
        self.assertEqual(out["payment"]["amount"], "1 USDC")
        self.assertEqual(len(fired), 1)
        over = json.loads(pay_x402_request(u, "https://api.example.com/data", max_amount_usdc="0.5"))
        self.assertEqual(over["code"], "MAX_AMOUNT")

    def test_bad_config(self):
        with self.assertRaises(UnsleptError):
            Unslept("nope")


if __name__ == "__main__":
    unittest.main()
