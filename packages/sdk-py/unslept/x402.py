"""x402 v2 HTTP transport helpers (PAYMENT-REQUIRED, PAYMENT-SIGNATURE, PAYMENT-RESPONSE, base64 JSON)."""
from __future__ import annotations

import base64
import json
import re
from typing import Any, Iterable, Optional

X402_VERSION = 2
HEADER_REQUIRED = "PAYMENT-REQUIRED"
HEADER_SIGNATURE = "PAYMENT-SIGNATURE"
HEADER_RESPONSE = "PAYMENT-RESPONSE"
SCHEME_EXACT = "exact"
SCHEME_UNSLEPT = "unslept-direct"

EIP3009_TYPES = {
    "TransferWithAuthorization": [
        {"name": "from", "type": "address"},
        {"name": "to", "type": "address"},
        {"name": "value", "type": "uint256"},
        {"name": "validAfter", "type": "uint256"},
        {"name": "validBefore", "type": "uint256"},
        {"name": "nonce", "type": "bytes32"},
    ]
}


class X402FormatError(ValueError):
    code = "X402_FORMAT"


def encode_header(value: Any) -> str:
    return base64.b64encode(json.dumps(value, separators=(",", ":")).encode()).decode()


def decode_header(value: str) -> Any:
    return json.loads(base64.b64decode(value.strip()).decode())


def read_payment_required(headers: dict[str, str]) -> dict:
    lower = {k.lower(): v for k, v in headers.items()}
    raw = lower.get(HEADER_REQUIRED.lower())
    if not raw:
        raise X402FormatError("The server answered 402 without a PAYMENT-REQUIRED header. Only x402 v2 servers are supported.")
    try:
        pr = decode_header(raw)
    except Exception as e:  # noqa: BLE001
        raise X402FormatError("The PAYMENT-REQUIRED header is not valid base64-encoded JSON.") from e
    if pr.get("x402Version") != X402_VERSION:
        raise X402FormatError(f"Unsupported x402Version {pr.get('x402Version')}. Expected {X402_VERSION}.")
    if not pr.get("accepts"):
        raise X402FormatError("The PAYMENT-REQUIRED header lists no accepted payment methods.")
    return pr


def select_requirement(pr: dict, network: str, asset: str, schemes: Iterable[str]) -> Optional[dict]:
    for scheme in schemes:
        for r in pr["accepts"]:
            if r.get("scheme") == scheme and r.get("network") == network and str(r.get("asset", "")).lower() == asset.lower():
                return r
    return None


def chain_id_from_caip2(network: str) -> int:
    m = re.fullmatch(r"eip155:(\d+)", network)
    if not m:
        raise X402FormatError(f"Network {network} is not an EVM CAIP-2 identifier.")
    return int(m.group(1))
