"""demo_emergency.py — Burst-pipe emergency escalation scenario.

Requires the mock server to be running:
    python scripts/dev_mock.py

Then run from backend/:
    uv run python scripts/demo_emergency.py [--host http://localhost:8000]
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


def _print_turn(last_turn: dict[str, Any]) -> None:
    print(f"  status   : {last_turn.get('status')}")
    print(f"  urgency  : {last_turn.get('urgency')}")
    c = last_turn.get("customer") or {}
    print(f"  customer : {c.get('name')} · {c.get('phone')}")
    for n in last_turn.get("notifications") or []:
        print(f"  🔔 {n['type']} — {n['reason']}")


def main() -> None:
    print(f"\n🚨  Demo: Emergency Burst-Pipe Escalation  (server: {HOST})")

    # ── Turn 1: customer reports the emergency ──────────────────────────────
    _banner("Turn 1 · Customer: burst pipe")
    msg1 = "My kitchen pipe just burst — water is everywhere, flooding the floor!"
    print(f"  Customer: {msg1}")
    r1 = _post("/api/chat", {"message": msg1})
    cid = r1["conversation_id"]
    print(f"  Agent   : {r1['reply']}")
    _print_turn(r1["last_turn"])

    # ── Turn 2: customer confirms location ──────────────────────────────────
    _banner("Turn 2 · Customer: confirms location")
    msg2 = "It's under the kitchen sink. I can't find the shutoff valve!"
    print(f"  Customer: {msg2}")
    r2 = _post("/api/chat", {"conversation_id": cid, "message": msg2})
    print(f"  Agent   : {r2['reply']}")
    _print_turn(r2["last_turn"])

    # ── Turn 3: customer provides their name ────────────────────────────────
    _banner("Turn 3 · Customer: provides name and phone")
    msg3 = "I'm Alex Dupont, my number is 647-555-9001."
    print(f"  Customer: {msg3}")
    r3 = _post("/api/chat", {"conversation_id": cid, "message": msg3})
    print(f"  Agent   : {r3['reply']}")
    _print_turn(r3["last_turn"])

    # ── Final state from dashboard ───────────────────────────────────────────
    _banner("Dashboard state · GET /api/conversations/{id}")
    state = _get(f"/api/conversations/{cid}")
    lt = state["last_turn"]
    print(f"  conversation_id : {state['conversation_id']}")
    print(f"  messages        : {len(state['messages'])} total")
    print(f"  final status    : {lt['status']} / {lt['urgency']}")
    notifications = lt.get("notifications") or []
    print(f"  notifications   : {len(notifications)}")
    for n in notifications:
        print(f"    · {n['type']}: {n['reason']}")

    print("\n✅  Scenario complete.\n")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.URLError as e:
        print(f"\n❌  Could not reach {HOST}: {e}")
        print("   Is the mock server running?  python scripts/dev_mock.py\n")
        sys.exit(1)
