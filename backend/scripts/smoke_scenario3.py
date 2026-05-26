"""Manual smoke test: Scenario 3 (scheduled, dishwasher reinstall).

Run from backend/ with:

    uv run python scripts/smoke_scenario3.py
"""

from __future__ import annotations

import asyncio
import json
import os
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()

tmpdir = tempfile.mkdtemp(prefix="pipeline-smoke-")
os.environ["LOCAL_STORAGE_DIR"] = tmpdir
os.environ.pop("GCS_BUCKET", None)

from app.agent import run_turn  # noqa: E402


async def main() -> None:
    cid = None
    turns = [
        "I need my dishwasher reinstalled sometime next week.",
        "I'm Aisha Khan, 555-7788, aisha@example.com",
        "It's replacing an existing one. Yes, supply line and drain are already there.",
        "I'll take slot-1.",
    ]
    for i, msg in enumerate(turns, 1):
        print(f"\n--- TURN {i}: customer ---\n{msg}")
        state, reply = await run_turn(cid, msg)
        cid = state["conversation_id"]
        lt = state["last_turn"]
        print(
            f"--- TURN {i}: agent (urgency={lt['urgency']}, status={lt['status']}) ---"
        )
        print(reply)
        print(f"customer: {lt.get('customer')}")
        if lt.get("booking", {}).get("slots_offered"):
            print(f"slots: {[s['label'] for s in lt['booking']['slots_offered']]}")
        if lt.get("booking", {}).get("selected_slot"):
            print(f"selected: {lt['booking']['selected_slot']['label']}")

    log = json.loads(
        (pathlib.Path(tmpdir) / "conversations" / cid / "llm_log.json").read_text()
    )
    print("\n=== TOOL CALLS PER TURN ===")
    for call in log["calls"]:
        if call["purpose"] == "conversation":
            tools = [t["name"] for t in call.get("function_calls", [])]
            print(f"turn {call['turn_number']}: {tools}")


if __name__ == "__main__":
    asyncio.run(main())
