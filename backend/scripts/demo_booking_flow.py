"""demo_booking_flow.py — Customer intake through to confirmed appointment booking.

Requires the mock server to be running:
    python scripts/dev_mock.py

Run from backend/:
    uv run python scripts/demo_booking_flow.py [http://localhost:8000]
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


def _print_booking(booking: dict[str, Any] | None) -> None:
    if not booking:
        print("  booking: (none)")
        return
    print(f"  booking_status : {booking.get('booking_status')}")
    slots = booking.get("slots_offered") or []
    if slots:
        print(f"  slots offered  : {len(slots)}")
        for s in slots:
            print(f"    [{s['slot_id']}] {s['label']}")
    selected = booking.get("selected_slot")
    if selected:
        print(f"  selected slot  : {selected['label']} (id={selected['slot_id']})")
    log = booking.get("ui_log") or []
    if log:
        print(f"  ui_log         : {log}")


def main() -> None:
    print(f"\n📅  Demo: Booking Flow — Intake to Confirmed Appointment  (server: {HOST})")

    # ── Turn 1: customer reports issue ──────────────────────────────────────
    _banner("Turn 1 · Customer: reports dripping faucet")
    msg1 = "My kitchen faucet is dripping constantly, even when I turn it fully off."
    print(f"  Customer: {msg1}")
    r1 = _post("/api/chat", {"message": msg1})
    cid = r1["conversation_id"]
    print(f"  Agent   : {r1['reply']}")
    lt1 = r1["last_turn"]
    print(f"  status  : {lt1['status']} / {lt1['urgency']}")

    # ── Turn 2: customer provides contact ───────────────────────────────────
    _banner("Turn 2 · Customer: contact info")
    msg2 = "I'm Sarah Williams, 416-555-0505."
    print(f"  Customer: {msg2}")
    r2 = _post("/api/chat", {"conversation_id": cid, "message": msg2})
    print(f"  Agent   : {r2['reply']}")

    # ── Turn 3: customer requests booking ───────────────────────────────────
    _banner("Turn 3 · Customer: wants to book")
    msg3 = "Can I book someone to come fix it? I'm free most of this week."
    print(f"  Customer: {msg3}")
    r3 = _post("/api/chat", {"conversation_id": cid, "message": msg3})
    print(f"  Agent   : {r3['reply']}")
    lt3 = r3["last_turn"]
    print(f"  status  : {lt3['status']} / {lt3['urgency']}")
    _print_booking(lt3.get("booking"))

    # ── Turn 4: customer selects a slot ─────────────────────────────────────
    _banner("Turn 4 · Customer: confirms time slot")
    booking = lt3.get("booking") or {}
    slots = booking.get("slots_offered") or []
    if slots:
        chosen = slots[0]
        msg4 = f"The {chosen['label']} slot works for me."
    else:
        msg4 = "Tomorrow morning works for me."
    print(f"  Customer: {msg4}")
    r4 = _post("/api/chat", {"conversation_id": cid, "message": msg4})
    print(f"  Agent   : {r4['reply']}")
    lt4 = r4["last_turn"]
    print(f"  status  : {lt4['status']} / {lt4['urgency']}")
    _print_booking(lt4.get("booking"))

    # ── Final dashboard state ────────────────────────────────────────────────
    _banner("Dashboard state · GET /api/conversations/{id}")
    state = _get(f"/api/conversations/{cid}")
    lt = state["last_turn"]
    print(f"  messages     : {len(state['messages'])} total")
    print(f"  final status : {lt['status']} / {lt['urgency']}")
    print(f"  customer     : {lt.get('customer', {}).get('name')} · {lt.get('customer', {}).get('phone')}")
    _print_booking(lt.get("booking"))

    print("\n✅  Scenario complete.\n")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.URLError as e:
        print(f"\n❌  Could not reach {HOST}: {e}")
        print("   Is the mock server running?  python scripts/dev_mock.py\n")
        sys.exit(1)
