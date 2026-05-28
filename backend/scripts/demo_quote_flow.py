"""demo_quote_flow.py — Full quote lifecycle: intake → draft → Jill approves → sent.

Requires the mock server to be running:
    python scripts/dev_mock.py

Run from backend/:
    uv run python scripts/demo_quote_flow.py [--approve|--reject] [http://localhost:8000]

Defaults to --approve.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from typing import Any

args = sys.argv[1:]
decision = "reject" if "--reject" in args else "approve"
HOST = next((a for a in args if a.startswith("http")), "http://localhost:8000")


def _post(path: str, body: dict[str, Any]) -> dict[str, Any]:
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{HOST}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def _get(path: str) -> dict[str, Any]:
    with urllib.request.urlopen(f"{HOST}{path}") as resp:
        return json.loads(resp.read())


def _banner(title: str) -> None:
    print(f"\n{'─' * 52}")
    print(f"  {title}")
    print(f"{'─' * 52}")


def _print_quote(quote: dict[str, Any] | None) -> None:
    if not quote:
        print("  quote: (none)")
        return
    print(f"  quote status  : {quote.get('quote_status')}")
    print(f"  summary       : {quote.get('job_summary')}")
    print(f"  price range   : {quote.get('estimated_price_range')}")
    for item in quote.get("scope") or []:
        print(f"    · {item}")


def main() -> None:
    print(f"\n📋  Demo: Quote Lifecycle — Jill will {decision.upper()}  (server: {HOST})")

    # ── Turn 1: customer describes the problem ──────────────────────────────
    _banner("Turn 1 · Customer: reports toilet leak")
    msg1 = "My toilet is leaking at the base and rocking when I sit on it."
    print(f"  Customer: {msg1}")
    r1 = _post("/api/chat", {"message": msg1})
    cid = r1["conversation_id"]
    print(f"  Agent   : {r1['reply']}")
    lt1 = r1["last_turn"]
    print(f"  status  : {lt1['status']} / {lt1['urgency']}")

    # ── Turn 2: customer provides name ──────────────────────────────────────
    _banner("Turn 2 · Customer: provides contact info")
    msg2 = "I'm Priya Nair, 905-555-0303. It's been leaking for two days."
    print(f"  Customer: {msg2}")
    r2 = _post("/api/chat", {"conversation_id": cid, "message": msg2})
    print(f"  Agent   : {r2['reply']}")

    # ── Turn 3: trigger quote generation ────────────────────────────────────
    _banner("Turn 3 · Customer: asks for a quote")
    msg3 = "Can you give me a quote for the repair?"
    print(f"  Customer: {msg3}")
    r3 = _post("/api/chat", {"conversation_id": cid, "message": msg3})
    print(f"  Agent   : {r3['reply']}")
    lt3 = r3["last_turn"]
    print(f"  status  : {lt3['status']} / {lt3['urgency']}")
    _print_quote(lt3.get("quote"))

    # ── Jill action: approve or reject ──────────────────────────────────────
    _banner(f"Jill action · POST /quote/decision  ({decision})")
    note = "Scope looks right." if decision == "approve" else "Price is too high for this job — revise."
    r_jill = _post(
        f"/api/conversations/{cid}/quote/decision",
        {"decision": decision, "note": note},
    )
    print(f"  note    : {note}")
    _print_quote(r_jill.get("quote"))

    # ── Final dashboard state ────────────────────────────────────────────────
    _banner("Dashboard state · GET /api/conversations/{id}")
    state = _get(f"/api/conversations/{cid}")
    final_quote = state["last_turn"].get("quote") or {}
    print(f"  final quote_status : {final_quote.get('quote_status')}")
    history = final_quote.get("history") or []
    print(f"  history ({len(history)} entries):")
    for entry in history:
        note_str = f" — {entry['note']}" if entry.get("note") else ""
        print(f"    [{entry['actor']}] {entry['status']}{note_str}")

    print("\n✅  Scenario complete.\n")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.URLError as e:
        print(f"\n❌  Could not reach {HOST}: {e}")
        print("   Is the mock server running?  python scripts/dev_mock.py\n")
        sys.exit(1)
