"""Tests for the Conversation Agent's function-call tools.

Verifies each tool mutates the working ``last_turn`` as documented in
the implementation plan §6.
"""

from __future__ import annotations

import datetime

import pytest

from app import agent_tools as tools
from app import conversation_store as cs


# ---------------------------------------------------------------------------
# Slot generation
# ---------------------------------------------------------------------------


def test_generate_demo_slots_returns_three_business_days():
    # Anchor on a Wednesday so the next three weekdays are Thu/Fri/Mon.
    wed = datetime.datetime(2026, 6, 3, 9, 0, 0)  # 2026-06-03 is a Wed
    slots = tools.generate_demo_slots(now=wed)

    assert len(slots) == 3
    assert slots[0]["slot_id"] == "slot-1"
    assert slots[2]["slot_id"] == "slot-3"
    # Every slot is at 10:00 and lands on a weekday.
    for s in slots:
        dt = datetime.datetime.fromisoformat(s["iso_datetime"])
        assert dt.hour == 10 and dt.minute == 0
        assert dt.weekday() < 5


def test_generate_demo_slots_skips_weekend():
    fri = datetime.datetime(2026, 6, 5, 9, 0, 0)  # 2026-06-05 is a Fri
    slots = tools.generate_demo_slots(now=fri)
    days = [datetime.datetime.fromisoformat(s["iso_datetime"]).weekday() for s in slots]
    # Tomorrow=Sat, Sun skipped. Next three weekdays = Mon, Tue, Wed.
    assert days == [0, 1, 2]


# ---------------------------------------------------------------------------
# TurnContext fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def ctx():
    return tools.TurnContext(
        cs.TurnSnapshot(
            turn_number=2,
            status="in_progress",
            urgency="priority",
            customer={},
            triage=None,
            quote=None,
            booking=cs.empty_booking(),
            sub_reason=None,
            notifications=[],
        )
    )


# ---------------------------------------------------------------------------
# set_customer_info
# ---------------------------------------------------------------------------


def test_set_customer_info_partial_update(ctx):
    ctx.set_customer_info(name="Mike T.")
    assert ctx.working["customer"] == {"name": "Mike T."}
    ctx.set_customer_info(phone="555-0123", email="mike@example.com")
    assert ctx.working["customer"] == {
        "name": "Mike T.",
        "phone": "555-0123",
        "email": "mike@example.com",
    }


def test_set_customer_info_strips_whitespace(ctx):
    ctx.set_customer_info(name="  Sarah  ", email=" sarah@x.com ")
    assert ctx.working["customer"]["name"] == "Sarah"
    assert ctx.working["customer"]["email"] == "sarah@x.com"


# ---------------------------------------------------------------------------
# generate_quote_draft
# ---------------------------------------------------------------------------


def test_generate_quote_draft_flips_status_and_stores_quote(ctx):
    quote = ctx.generate_quote_draft(
        problem_type="hot_water_tank",
        job_summary="Hot water tank not producing heat.",
    )
    assert ctx.working["status"] == "quoted"
    assert ctx.working["quote"]["quote_status"] == "pending_jill_review"
    assert ctx.working["quote"]["estimated_price_range"] == "$250-$600"
    assert quote["job_summary"] == "Hot water tank not producing heat."


def test_generate_quote_draft_unknown_type_falls_back_to_default(ctx):
    quote = ctx.generate_quote_draft(
        problem_type="not_a_real_type",
        job_summary="Something weird.",
    )
    # Default template kicks in.
    assert quote["estimated_price_range"] == "$150-$500"


# ---------------------------------------------------------------------------
# propose_slots + confirm_slot
# ---------------------------------------------------------------------------


def test_propose_slots_offers_three_and_flips_booking(ctx):
    slots = ctx.propose_slots()
    assert len(slots) == 3
    assert ctx.working["booking"]["booking_status"] == "link_sent"
    assert ctx.working["booking"]["booking_method"] == "calendly"
    assert any("Calendly link" in line for line in ctx.working["booking"]["ui_log"])


def test_confirm_slot_records_selection_and_books(ctx):
    ctx.propose_slots()
    result = ctx.confirm_slot("slot-2")
    assert result == "confirmed"
    assert ctx.working["status"] == "booked"
    assert ctx.working["booking"]["booking_status"] == "booked"
    assert ctx.working["booking"]["selected_slot"]["slot_id"] == "slot-2"
    assert any(
        "Would create Calendly event" in line
        for line in ctx.working["booking"]["ui_log"]
    )


def test_confirm_slot_rejects_unknown_id(ctx):
    ctx.propose_slots()
    result = ctx.confirm_slot("slot-99")
    assert "unknown" in result
    assert ctx.working["status"] == "in_progress"  # unchanged


# ---------------------------------------------------------------------------
# close_conversation
# ---------------------------------------------------------------------------


def test_close_conversation_booked_maps_to_closed_done(ctx):
    ctx.close_conversation(sub_reason="booked")
    assert ctx.working["status"] == "closed_done"
    assert ctx.working["sub_reason"] == "booked"


def test_close_conversation_decline_maps_to_closed_no_action(ctx):
    ctx.close_conversation(sub_reason="customer_declined")
    assert ctx.working["status"] == "closed_no_action"
    assert ctx.working["sub_reason"] == "customer_declined"


def test_close_conversation_rejects_invalid_reason(ctx):
    result = ctx.close_conversation(sub_reason="vibes")
    assert "invalid" in result
    assert ctx.working["status"] == "in_progress"  # unchanged


# ---------------------------------------------------------------------------
# notify_jill
# ---------------------------------------------------------------------------


def test_notify_jill_appends_notification(ctx):
    ctx.notify_jill(reason="Basement flooding emergency")
    notifs = ctx.working["notifications"]
    assert len(notifs) == 1
    assert notifs[0]["type"] == "would_sms_jill"
    assert "flooding" in notifs[0]["reason"]


def test_notify_jill_can_fire_multiple_times(ctx):
    ctx.notify_jill(reason="A")
    ctx.notify_jill(reason="B")
    assert len(ctx.working["notifications"]) == 2


# ---------------------------------------------------------------------------
# snapshot + tool call log
# ---------------------------------------------------------------------------


def test_snapshot_captures_working_state(ctx):
    ctx.set_customer_info(name="Mike")
    ctx.generate_quote_draft(problem_type="hot_water_tank", job_summary="Tank cold.")
    snap = ctx.snapshot()
    assert snap["customer"]["name"] == "Mike"
    assert snap["status"] == "quoted"
    assert snap["quote"]["estimated_price_range"] == "$250-$600"


def test_tool_call_log_records_every_call(ctx):
    ctx.set_customer_info(name="A")
    ctx.notify_jill(reason="x")
    ctx.close_conversation(sub_reason="spam")
    names = [c["name"] for c in ctx.tool_calls]
    assert names == ["set_customer_info", "notify_jill", "close_conversation"]


def test_as_tool_list_exposes_six_methods(ctx):
    tool_list = ctx.as_tool_list()
    assert len(tool_list) == 6
    names = {t.__name__ for t in tool_list}
    assert names == {
        "set_customer_info",
        "generate_quote_draft",
        "propose_slots",
        "confirm_slot",
        "close_conversation",
        "notify_jill",
    }
