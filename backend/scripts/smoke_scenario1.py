"""Manual smoke test: Scenario 1 (emergency basement flooding).

Run from backend/ with:

    uv run python scripts/smoke_scenario1.py
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
    state, reply = await run_turn(
        None, "Water is spraying everywhere and my basement is flooding!"
    )
    cid = state["conversation_id"]
    lt = state["last_turn"]
    print(f"--- TURN 1 (urgency={lt['urgency']}, status={lt['status']}) ---")
    print(reply)
    print(f"notifications: {lt.get('notifications')}")

    log = json.loads(
        (pathlib.Path(tmpdir) / "conversations" / cid / "llm_log.json").read_text()
    )
    print("\n=== TOOL CALLS ===")
    for call in log["calls"]:
        if call["purpose"] == "conversation":
            tools = [t["name"] for t in call.get("function_calls", [])]
            print(f"turn {call['turn_number']}: {tools}")


if __name__ == "__main__":
    asyncio.run(main())
