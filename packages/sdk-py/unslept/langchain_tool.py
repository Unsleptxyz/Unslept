"""LangChain tool wrapper. Requires `pip install unslept[langchain]`."""
from __future__ import annotations

import json
from typing import Any, Optional

from .client import Unslept, UnsleptError, fmt_usdc


def _parse_usdc(s: str) -> int:
    whole, _, frac = s.strip().partition(".")
    if not whole.isdigit() or (frac and (not frac.isdigit() or len(frac) > 6)):
        raise ValueError(f'"{s}" is not a USDC amount. Use a decimal such as 0.50.')
    return int(whole) * 10**6 + int(frac.ljust(6, "0") or 0)


def pay_x402_request(unslept: Unslept, url: str, method: str = "GET", body: Optional[str] = None,
                     max_amount_usdc: Optional[str] = None) -> str:
    """Plain function behind the tool, usable without LangChain."""
    before = len(unslept.local_payments())
    try:
        res = unslept.fetch(url, method=method, body=body.encode() if body else None,
                            max_amount=_parse_usdc(max_amount_usdc) if max_amount_usdc else None)
    except UnsleptError as e:
        return json.dumps({"error": str(e), "code": e.code})
    new = unslept.local_payments()[before:]
    return json.dumps({
        "status": res.status,
        "body": res.text()[:100_000],
        "payment": {"amount": fmt_usdc(new[0].amount), "payee": new[0].payee, "transaction": new[0].transaction} if new else None,
    })


def unslept_tool(unslept: Unslept) -> Any:
    """Returns a LangChain StructuredTool named pay_x402_request."""
    try:
        from langchain_core.tools import StructuredTool
    except ImportError as e:
        raise ImportError("langchain-core is not installed. Run: pip install 'unslept[langchain]'") from e

    def _run(url: str, method: str = "GET", body: Optional[str] = None, max_amount_usdc: Optional[str] = None) -> str:
        return pay_x402_request(unslept, url, method, body, max_amount_usdc)

    return StructuredTool.from_function(
        func=_run,
        name="pay_x402_request",
        description=("Make an HTTP request. If the server answers 402 Payment Required, pay it from the agent's "
                     "Unslept account within its spending policy. Optional max_amount_usdc caps this payment."),
    )
