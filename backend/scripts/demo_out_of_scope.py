"""demo_out_of_scope.py — Gas smell safety referral, then Jill closes the conversation.

Covers two L0 exit paths in one script:
  1. AI detects out-of-scope issue → sends safety referral → closes automatically
  2. Jill manually closes a conversation with a sub_reason via /api/conversations/{id}/close

Requires the mock server to be running:
    python scripts/dev_mock.py

Run from backend/:
    uv run python scripts/demo_out_of_scope.py [http://localhost:8000]
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from typing import Any

HOST = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"


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


def _print_turn(lt: dict[str, Any]) -> None:
    print(f"  status      : {lt.get('status')}")
    print(f"  urgency     : {lt.get('urgency')}")
    print(f"  sub_reason  : {lt.get('sub_reason')}")
    for n in lt.get("notifications") or []:
        print(f"  🔔 {n['type']} — {n['reason']}")


def main() -> None:
    print(f"\n⚠️   Demo: Out-of-Scope Safety Referral + Manual Close  (server: {HOST})")

    # ── Part A: Gas smell → automatic safety referral ───────────────────────
    print("\n── Part A: Gas smell (out-of-scope) ──")

    _banner("Turn 1 · Customer: reports gas smell")
    msg1 = "I can smell gas in my basement near the furnace area."
    print(f"  Customer: {msg1}")
    r1 = _post("/api/chat", {"message": msg1})
    cid_gas = r1["conversation_id"]
    print(f"  Agent   : {r1['reply']}")
    _print_turn(r1["last_turn"])

    _banner("Dashboard state after gas-smell conversation")
    state_gas = _get(f"/api/conversations/{cid_gas}")
    lt = state_gas["last_turn"]
    print(f"  closed with sub_reason: {lt.get('sub_reason')}")
    print(f"  safety notification:    {(lt.get('notifications') or [{}])[0].get('type')}")

    # ── Part B: Wrong number → Jill manually closes ─────────────────────────
    print("\n\n── Part B: Wrong number — Jill manually closes ──")

    _banner("Turn 1 · Customer: wrong number")
    msg_wr = "Hi, is this the pizza place? I want to order a large pepperoni."
    print(f"  Customer: {msg_wr}")
    r_wr = _post("/api/chat", {"message": msg_wr})
    cid_wr = r_wr["conversation_id"]
    print(f"  Agent   : {r_wr['reply']}")
    lt_wr = r_wr["last_turn"]
    print(f"  status  : {lt_wr['status']} / {lt_wr['urgency']}")

    _banner("Jill action · POST /close  (sub_reason: wrong_number)")
    r_close = _post(
        f"/api/conversations/{cid_wr}/close",
        {"sub_reason": "wrong_number"},
    )
    print(f"  status     : {r_close.get('status')}")
    print(f"  sub_reason : {r_close.get('sub_reason')}")

    # ── Part C: Out-of-area → Jill manually closes ──────────────────────────
    print("\n\n── Part C: Out of service area — Jill manually closes ──")

    _banner("Turn 1 · Customer: outside GTA")
    msg_oa = "Hi, I need a plumber at my cottage in Muskoka, it's about 3 hours north."
    print(f"  Customer: {msg_oa}")
    r_oa = _post("/api/chat", {"message": msg_oa})
    cid_oa = r_oa["conversation_id"]
    print(f"  Agent   : {r_oa['reply']}")

    _banner("Jill action · POST /close  (sub_reason: out_of_area)")
    r_close_oa = _post(
        f"/api/conversations/{cid_oa}/close",
        {"sub_reason": "out_of_area"},
    )
    print(f"  status     : {r_close_oa.get('status')}")
    print(f"  sub_reason : {r_close_oa.get('sub_reason')}")

    # ── Summary ─────────────────────────────────────────────────────────────
    _banner("Summary — all three out-of-scope conversations")
    conversations = _get("/api/conversations")["conversations"]
    relevant = [c for c in conversations if c["conversation_id"] in {cid_gas, cid_wr, cid_oa}]
    for c in relevant:
        print(f"  {c['conversation_id']:<26} {c['status']:<18} sub={c.get('sub_reason')}")

    print("\n✅  Scenario complete.\n")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.URLError as e:
        print(f"\n❌  Could not reach {HOST}: {e}")
        print("   Is the mock server running?  python scripts/dev_mock.py\n")
        sys.exit(1)
