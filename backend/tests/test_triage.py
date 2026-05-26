"""Tests for E9 triage classification.

Covers the post-Calen-KB taxonomy:

- L0 safety escalation (gas smell, water+electrical, sewage+vulnerable
  occupant, sewer gas + symptoms)
- L0 wrong-trade OOS (pool, well, septic, gas boiler, irrigation)
- L0 boundary OOS (no water + neighbours, low pressure + neighbours,
  yard + sewer signs)
- L1 emergency / L2 priority / L3 scheduled (existing behaviour)
"""

from __future__ import annotations

import pytest

from app.services.triage import classify_urgency


# ---------------------------------------------------------------------------
# Demo scenario coverage
# ---------------------------------------------------------------------------


def test_demo_scenario_1_emergency_basement_flooding():
    result = classify_urgency(
        "Water is spraying everywhere and my basement is flooding."
    )
    assert result["urgency_level"] == "emergency"
    assert result["internal_level"] == "L1_immediate"
    assert result["continue_normal_flow"] is False
    assert result["requires_human_followup"] is True
    assert result["customer_facing_guidance"] is not None
    assert "main water valve" in result["customer_facing_guidance"]
    assert result["classification_source"] == "rules"
    assert result["needs_clarification"] is False
    assert result["active_damage_confirmed"] is True


def test_demo_scenario_2_priority_hot_water_tank():
    result = classify_urgency(
        "My hot water tank stopped working and I need someone soon."
    )
    assert result["urgency_level"] == "priority"
    assert result["internal_level"] == "L2_24h_to_48"
    assert result["continue_normal_flow"] is True
    assert result["requires_human_followup"] is True
    assert result["customer_facing_guidance"] is None
    assert result["classification_source"] == "rules"
    assert result["active_damage_confirmed"] is False
    assert result["customer_claimed_emergency"] is True


def test_demo_scenario_3_scheduled_dishwasher_next_week():
    result = classify_urgency(
        "I need my dishwasher reinstalled sometime next week."
    )
    assert result["urgency_level"] == "scheduled"
    assert result["internal_level"] == "L3_more_than_48h"
    assert result["continue_normal_flow"] is True
    assert result["requires_human_followup"] is False
    assert result["customer_facing_guidance"] is None
    assert result["classification_source"] == "rules"


# ---------------------------------------------------------------------------
# L0 safety escalation (the post-Calen-KB additions).
# Gas smell and water-near-electrical were L1 emergencies before this
# update; they are now L0 safety escalations.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "I smell gas in the basement.",
        "There's a gas smell in my kitchen.",
        "I think we have a gas leak in the laundry room.",
    ],
)
def test_safety_escalation_gas_smell(message):
    result = classify_urgency(message)
    assert result["urgency_level"] == "safety_escalation", message
    assert result["internal_level"] == "L0_safety"
    assert result["continue_normal_flow"] is False
    assert result["requires_human_followup"] is True
    assert result["customer_facing_guidance"]
    assert "Enbridge" in result["customer_facing_guidance"]
    assert "1-866-763-5427" in result["customer_facing_guidance"]


@pytest.mark.parametrize(
    "message",
    [
        "Water is near the electrical outlet on the wall.",
        "There's water pooling near the electrical panel in the basement.",
        "Water dripping onto an outlet in the kitchen.",
    ],
)
def test_safety_escalation_water_near_electrical(message):
    result = classify_urgency(message)
    assert result["urgency_level"] == "safety_escalation", message
    assert result["internal_level"] == "L0_safety"
    assert result["continue_normal_flow"] is False
    assert "breaker" in result["customer_facing_guidance"].lower()


@pytest.mark.parametrize(
    "message",
    [
        "Sewage is backing up into the bathroom and my baby is in the home.",
        "There's sewage in the basement and my grandmother lives with us.",
        "Sewage on the floor; we have a newborn upstairs.",
    ],
)
def test_safety_escalation_sewage_with_vulnerable_occupant(message):
    result = classify_urgency(message)
    assert result["urgency_level"] == "safety_escalation", message
    assert result["internal_level"] == "L0_safety"
    assert result["continue_normal_flow"] is False
    assert "911" in result["customer_facing_guidance"]


def test_safety_escalation_sewer_gas_with_symptoms():
    result = classify_urgency(
        "There's a sewer gas smell in the laundry room and I feel dizzy."
    )
    assert result["urgency_level"] == "safety_escalation"
    assert result["internal_level"] == "L0_safety"
    assert result["continue_normal_flow"] is False
    assert "hydrogen sulfide" in result["customer_facing_guidance"]


def test_safety_escalation_takes_priority_over_soft_urgency():
    result = classify_urgency(
        "I smell gas in the basement and I need help ASAP!"
    )
    assert result["urgency_level"] == "safety_escalation"
    assert result["internal_level"] == "L0_safety"


# ---------------------------------------------------------------------------
# L0 wrong-trade OOS.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message,expected_signal_fragment",
    [
        ("My hot tub equipment is leaking, can you help?", "pool or hot tub"),
        ("The pool pump is making a weird noise.", "pool or hot tub"),
        ("We're on a well and the well pump stopped working.", "well system"),
        ("Our septic tank is backing up into the yard.", "septic system"),
        ("Our gas boiler isn't firing up this morning.", "gas boiler"),
        ("I need irrigation system winterization before frost.", "irrigation"),
    ],
)
def test_wrong_trade_oos_classification(message, expected_signal_fragment):
    result = classify_urgency(message)
    assert result["urgency_level"] == "wrong_trade_oos", message
    assert result["internal_level"] == "L0_oos"
    assert result["continue_normal_flow"] is False
    assert result["requires_human_followup"] is True
    assert result["customer_facing_guidance"]
    assert expected_signal_fragment in result["matched_signals"]


# ---------------------------------------------------------------------------
# L0 boundary OOS (may be municipal vs owner-side).
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "We have no water at all, and the neighbours also have no water.",
        "No water in our house. My neighbours are also out.",
        "There's no water anywhere on our whole street this morning.",
    ],
)
def test_boundary_oos_no_water_with_neighbours(message):
    result = classify_urgency(message)
    assert result["urgency_level"] == "boundary_oos", message
    assert result["internal_level"] == "L0_oos"
    assert result["continue_normal_flow"] is False
    assert "311" in result["customer_facing_guidance"]


@pytest.mark.parametrize(
    "message",
    [
        "Low water pressure across the whole street since this morning.",
        "We have weak water pressure and so do all the neighbours.",
    ],
)
def test_boundary_oos_low_pressure_with_neighbours(message):
    result = classify_urgency(message)
    assert result["urgency_level"] == "boundary_oos", message
    assert result["internal_level"] == "L0_oos"


def test_boundary_oos_yard_sewer_signs():
    result = classify_urgency(
        "There's a sinkhole in the front yard above the sewer line."
    )
    assert result["urgency_level"] == "boundary_oos"
    assert result["internal_level"] == "L0_oos"


# Sanity: "no water" alone (without neighbours) must remain an L1 emergency.
def test_no_water_alone_remains_emergency():
    result = classify_urgency("I have no water at all in the house.")
    assert result["urgency_level"] == "emergency"
    assert result["internal_level"] == "L1_immediate"


# ---------------------------------------------------------------------------
# L0 sanity: never offer quote / Calendly when safety / OOS is detected.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "I smell gas in the basement.",
        "My hot tub equipment is leaking.",
        "No water here, neighbours are also out.",
    ],
)
def test_l0_never_continues_normal_flow(message):
    result = classify_urgency(message)
    assert result["urgency_level"] in {
        "safety_escalation",
        "wrong_trade_oos",
        "boundary_oos",
    }, message
    # L0 must bypass quoting + Calendly: orchestrator reads
    # continue_normal_flow.
    assert result["continue_normal_flow"] is False


# ---------------------------------------------------------------------------
# Emergency variants (L1) -- gas smell + water-near-electrical removed
# from this group; they're now L0 safety escalations above.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "There's a burst pipe under the kitchen sink.",
        "I have no water in the home at all.",
        "There's sewage backing up into the tub.",
        "Pipe burst, water everywhere!",
        "Our pipes are frozen in this cold snap.",
    ],
)
def test_emergency_variants_classify_as_emergency(message):
    result = classify_urgency(message)
    assert result["urgency_level"] == "emergency", message
    assert result["internal_level"] == "L1_immediate"
    assert result["continue_normal_flow"] is False
    assert result["customer_facing_guidance"]


# ---------------------------------------------------------------------------
# "no hot water" must NOT trigger the "no water" emergency rule
# ---------------------------------------------------------------------------


def test_no_hot_water_is_priority_not_emergency():
    result = classify_urgency("I have no hot water in the house.")
    assert result["urgency_level"] == "priority"


def test_no_water_is_emergency():
    result = classify_urgency("I have no water at all in the house.")
    assert result["urgency_level"] == "emergency"


# ---------------------------------------------------------------------------
# Priority variants
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "The toilet won't flush.",
        "I have a small contained leak under the sink.",
        "The faucet has been dripping for a few days.",
        "We need someone today.",
        "Can you come this week? My hot water tank stopped working.",
    ],
)
def test_priority_variants_classify_as_priority(message):
    result = classify_urgency(message)
    assert result["urgency_level"] == "priority", message
    assert result["internal_level"] == "L2_24h_to_48"
    assert result["continue_normal_flow"] is True


# ---------------------------------------------------------------------------
# Scheduled variants
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "Need a faucet replacement, no rush.",
        "We're renovating the kitchen and need plumbing done.",
        "I'd like to install a dishwasher whenever works for you.",
        "Looking to do a faucet install in a couple weeks.",
    ],
)
def test_scheduled_variants_classify_as_scheduled(message):
    result = classify_urgency(message)
    assert result["urgency_level"] == "scheduled", message
    assert result["internal_level"] == "L3_more_than_48h"
    assert result["continue_normal_flow"] is True
    assert result["requires_human_followup"] is False


# ---------------------------------------------------------------------------
# Soft-urgency-only: claims emergency but no hard signals.
# Should be priority + needs_clarification.
# ---------------------------------------------------------------------------


def test_soft_urgency_alone_is_priority_with_clarification():
    result = classify_urgency("I need help ASAP!")
    assert result["urgency_level"] == "priority"
    assert result["needs_clarification"] is True
    assert result["customer_claimed_emergency"] is True
    assert result["active_damage_confirmed"] is False
    assert result["classification_source"] == "rules"


def test_urgent_word_alone_is_priority_with_clarification():
    result = classify_urgency("This is urgent, please come right now.")
    assert result["urgency_level"] == "priority"
    assert result["needs_clarification"] is True


def test_hard_emergency_with_urgent_language_stays_emergency():
    result = classify_urgency(
        "Burst pipe in the basement, water everywhere, please come ASAP!"
    )
    assert result["urgency_level"] == "emergency"
    assert result["needs_clarification"] is False


# ---------------------------------------------------------------------------
# LLM fallback
# ---------------------------------------------------------------------------


def test_llm_fallback_when_no_rules_match():
    def fake_llm(message: str) -> dict:
        return {
            "urgency_level": "scheduled",
            "reason": "Customer asked an out-of-template scoping question.",
            "confidence": 0.7,
        }

    result = classify_urgency(
        "Hi, do you handle commercial plumbing inspections?",
        llm_client=fake_llm,
    )
    assert result["urgency_level"] == "scheduled"
    assert result["classification_source"] == "llm"
    assert result["internal_level"] == "L3_more_than_48h"
    assert "out-of-template" in result["reason"]


def test_llm_fallback_with_garbage_falls_back_to_safe_default():
    def garbage_llm(message: str) -> dict:
        return {"unexpected": "shape"}

    result = classify_urgency(
        "Hi, do you handle commercial plumbing inspections?",
        llm_client=garbage_llm,
    )
    assert result["urgency_level"] == "priority"
    assert result["classification_source"] == "safe_default"
    assert result["needs_clarification"] is True


def test_llm_exception_falls_back_to_safe_default():
    def broken_llm(message: str) -> dict:
        raise RuntimeError("API down")

    result = classify_urgency(
        "Hi, do you handle commercial plumbing inspections?",
        llm_client=broken_llm,
    )
    assert result["classification_source"] == "safe_default"
    assert result["urgency_level"] == "priority"


def test_llm_returns_non_dict_falls_back_to_safe_default():
    def string_llm(message: str) -> dict:
        return "emergency"  # type: ignore[return-value]

    result = classify_urgency(
        "Hi, do you handle commercial plumbing inspections?",
        llm_client=string_llm,
    )
    assert result["classification_source"] == "safe_default"


def test_llm_cannot_assign_l0_levels():
    """The LLM whitelist excludes L0 urgency values. If an LLM returns
    one, we treat it as malformed and fall back to safe default."""

    def l0_returning_llm(message: str) -> dict:
        return {
            "urgency_level": "safety_escalation",
            "reason": "LLM tried to assign safety escalation.",
            "confidence": 0.9,
        }

    result = classify_urgency(
        "Hi, do you handle commercial plumbing inspections?",
        llm_client=l0_returning_llm,
    )
    assert result["classification_source"] == "safe_default"
    assert result["urgency_level"] == "priority"


# ---------------------------------------------------------------------------
# Safe default when no rules and no LLM
# ---------------------------------------------------------------------------


def test_safe_default_when_no_rules_and_no_llm():
    result = classify_urgency("Hello, are you open on Saturdays?")
    assert result["urgency_level"] == "priority"
    assert result["confidence"] < 0.5
    assert result["classification_source"] == "safe_default"
    assert result["needs_clarification"] is True


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------


def test_non_string_message_raises():
    with pytest.raises(TypeError):
        classify_urgency(123)  # type: ignore[arg-type]


def test_history_widens_the_scan():
    result = classify_urgency(
        "Yes",
        history=["My basement is flooding right now"],
    )
    assert result["urgency_level"] == "emergency"
