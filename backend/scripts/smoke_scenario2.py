"""Manual smoke test: walk Scenario 2 (priority, hot water tank) end-to-end.

Run from backend/ with:

    uv run python scripts/smoke_scenario2.py
"""

from __future__ import annotations

import asyncio
import json
import os
import pathlib
import sys
import tempfile

# Make ``app`` importable when invoked from backend/.
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
        "My hot water tank stopped working and I need someone soon.",
        "I'm Mike Tremblay, 555-0123, mike@example.com",
        "It's a gas tank, and it's not heating — no leak that I can see.",
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
        if lt.get("quote"):
            print(
                f"quote: {lt['quote']['quote_status']} "
                f"({lt['quote']['estimated_price_range']})"
            )
        if lt.get("notifications"):
            print(f"notifications: {lt['notifications']}")

    log_path = pathlib.Path(tmpdir) / "conversations" / cid / "llm_log.json"
    log = json.loads(log_path.read_text())
    print("\n=== TOOL CALLS PER TURN ===")
    for call in log["calls"]:
        if call["purpose"] == "conversation":
            tools = [t["name"] for t in call.get("function_calls", [])]
            print(f"turn {call['turn_number']}: {tools}")


if __name__ == "__main__":
    asyncio.run(main())
