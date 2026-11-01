"""x402 v2 HTTP transport helpers (PAYMENT-REQUIRED, PAYMENT-SIGNATURE, PAYMENT-RESPONSE, base64 JSON)."""
from __future__ import annotations

import base64
import json
from typing import Any, Iterable, Optional

X402_VERSION = 2
HEADER_REQUIRED = "PAYMENT-REQUIRED"
HEADER_SIGNATURE = "PAYMENT-SIGNATURE"
HEADER_RESPONSE = "PAYMENT-RESPONSE"
SCHEME_UNSLEPT = "unslept-direct"

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
            if r.get("scheme") == scheme and r.get("network") == network and r.get("asset") == asset:
                return r
    return None
