"""E9 - Triage and urgency classification.

Hybrid classifier: rule-based pattern matching first, with optional LLM
fallback when no rules fire. Falls back to a safe ``priority`` default when
no rules match and no LLM is provided.

The classifier returns a flat dict ready for direct rendering on the
dashboard or further routing by the orchestrator.

Product rules baked in (post Calen plumbing-KB update):

- **L0 safety escalation** (``urgency_level = "safety_escalation"``,
  ``internal_level = "L0_safety"``). Gas smell anywhere in the home,
  water near electrical, sewage backup with a vulnerable occupant, or
  sewer gas with reported symptoms. These bypass quoting and Calendly.
  The customer receives a verbatim safety script with a specific phone
  number; Jill gets the conversation immediately for a welfare
  follow-up.
- **L0 wrong-trade OOS** (``urgency_level = "wrong_trade_oos"``,
  ``internal_level = "L0_oos"``). Pool / hot tub equipment, well systems,
  septic systems, gas boilers, irrigation systems. Real problems, wrong
  specialist. No quote, no Calendly. Flagged for Jill as a referral
  opportunity.
- **L0 boundary OOS** (``urgency_level = "boundary_oos"``,
  ``internal_level = "L0_oos"``). Symptoms that may be the city's
  responsibility (no water with neighbours affected, whole-house low
  pressure with neighbours affected, yard sewer signs). Customer is
  pointed at 311 first; Jill follows up if the issue turns out to be
  owner-side.
- **L1 emergency** (``urgency_level = "emergency"``,
  ``internal_level = "L1_immediate"``). Active uncontrolled water,
  sewage in living space (no vulnerable signal), burst pipe, frozen
  pipe risk, no water at this property (without neighbours signal).
- **L2 priority** (``urgency_level = "priority"``,
  ``internal_level = "L2_24h_to_48"``). Contained but urgent: no hot
  water, contained leak, toilet not working.
- **L3 scheduled** (``urgency_level = "scheduled"``,
  ``internal_level = "L3_more_than_48h"``). Planned work, flexible
  timing.

Detection bias: when in doubt between L0 safety and L1 emergency,
prefer L0. A false positive costs nothing (the customer hears a safety
reminder); a false negative is catastrophic. This is consistent with
NFR-05's no-hallucination rule on safety facts.

We never produce DIY repair advice. The only customer-facing guidance
is a short safety / redirect instruction on the L0 and emergency paths.
"""

from __future__ import annotations

import re
from typing import Callable, Literal, Optional, TypedDict

UrgencyLevel = Literal[
    "safety_escalation",
    "wrong_trade_oos",
    "boundary_oos",
    "emergency",
    "priority",
    "scheduled",
]
InternalLevel = Literal[
    "L0_safety",
    "L0_oos",
    "L1_immediate",
    "L2_24h_to_48",
    "L3_more_than_48h",
]
ClassificationSource = Literal["rules", "llm", "safe_default"]


class TriageResult(TypedDict):
    urgency_level: UrgencyLevel
    urgency_label: str
    internal_level: InternalLevel
    confidence: float
    reason: str
    recommended_action: str
    customer_facing_guidance: Optional[str]
    requires_human_followup: bool
    continue_normal_flow: bool
    needs_clarification: bool
    customer_claimed_emergency: bool
    active_damage_confirmed: bool
    classification_source: ClassificationSource
    matched_signals: list[str]


# Optional callable: takes the customer message and returns a dict with at
# minimum {"urgency_level": "...", "reason": "..."}. Kept loose so the
# orchestrator can wire OpenAI / Vertex / MS Agent without coupling this
# module to any SDK.
LlmClient = Callable[[str], dict]


# ---------------------------------------------------------------------------
# Signal patterns
# ---------------------------------------------------------------------------

# L0 SAFETY -- gas smell (anywhere in the home).
_SAFETY_GAS_PATTERN = re.compile(
    r"\b(smell(s|ing)?|smelt)\s+(of\s+)?gas\b"
    r"|\bgas\s+smell\b"
    r"|\bsmell(s|ing)?\s+like\s+gas\b"
    r"|\bgas\s+(leak|leaking)\b",
    re.I,
)

# L0 SAFETY -- water in the same area as electrical outlets, panels, breakers,
# or wiring. Matches in either order so "outlet has water around it" also fires.
_SAFETY_WATER_ELECTRICAL_PATTERN = re.compile(
    r"\bwater\b.{0,40}\b(outlet|outlets|electrical|panel|breaker|breakers|wiring)\b"
    r"|\b(outlet|outlets|electrical|panel|breaker|breakers|wiring)\b.{0,40}\bwater\b",
    re.I,
)

# L0 SAFETY -- sewage backup + vulnerable occupant (baby, infant, child,
# elderly, pregnant, immunocompromised, etc.).
_SEWAGE_PATTERN = re.compile(
    r"\bsewage\b|\bsewer\s+back(ing|ed)?\s*up\b",
    re.I,
)
_VULNERABLE_OCCUPANT_PATTERN = re.compile(
    r"\b(baby|babies|infant|infants|newborn|toddler|child|children|kid|kids"
    r"|elderly|grandma|grandmother|grandpa|grandfather|granny"
    r"|pregnant|expecting|immunocompromised|immune\s+compromised)\b",
    re.I,
)

# L0 SAFETY -- sewer gas + symptoms.
_SEWER_GAS_PATTERN = re.compile(r"\bsewer\s+gas\b|\bsewer\s+smell\b", re.I)
_SYMPTOM_PATTERN = re.compile(
    r"\b(dizzy|dizziness|nauseous|nausea|headache|head\s+ache"
    r"|unwell|lightheaded|light\s+headed|hard\s+to\s+breathe"
    r"|trouble\s+breathing|short\s+of\s+breath)\b",
    re.I,
)

# L0 WRONG-TRADE OOS -- match by trade keyword.
_WRONG_TRADE_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("pool or hot tub", re.compile(r"\b(pool|hot\s+tub|spa|jacuzzi)\b", re.I)),
    ("well system", re.compile(r"\b(well\s+pump|well\s+water|on\s+a\s+well)\b", re.I)),
    ("septic system", re.compile(r"\bseptic\b", re.I)),
    ("gas boiler", re.compile(r"\bgas\s+(boiler|furnace)\b|\bboiler\b.{0,20}\bgas\b", re.I)),
    ("irrigation", re.compile(r"\b(irrigation|sprinkler\s+system|sprinklers)\b", re.I)),
]

# L0 BOUNDARY OOS -- a plumbing-sounding symptom that is likely municipal.
# Each is a pair of patterns; BOTH must match in the haystack.
_NEIGHBOURS_PATTERN = re.compile(
    r"\bneighbou?rs?\b"
    r"|\bwhole\s+(street|block|neighbou?rhood)\b"
    r"|\bdown\s+the\s+street\b"
    r"|\bothers?\s+(on|in)\s+(the\s+)?(street|block)\b"
    r"|\beveryone\s+(on|in)\s+(the\s+)?(street|block)\b",
    re.I,
)
_NO_WATER_BASIC_PATTERN = re.compile(r"(?<!hot\s)\bno\s+water\b(?!\s+heater)", re.I)
_LOW_PRESSURE_PATTERN = re.compile(
    r"\blow\s+(water\s+)?pressure\b|\bweak\s+(water\s+)?pressure\b",
    re.I,
)
_YARD_PATTERN = re.compile(r"\b(yard|lawn|driveway|front\s+lawn|back\s+yard)\b", re.I)
_YARD_SEWER_SIGN_PATTERN = re.compile(r"\b(sinkhole|sewage|sewer\s+line|sewer)\b", re.I)


# L1 EMERGENCY patterns. Any match means: stop normal flow, alert Jill,
# show safety guidance. Each entry is (label, compiled regex).
#
# "no water" intentionally uses a negative lookbehind so it does NOT match
# "no hot water" (which is a priority signal, not an emergency).
_EMERGENCY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("basement flooding", re.compile(r"\bbasement\b.*\bflood(ing|ed)?\b|\bflood(ing|ed)?\b.*\bbasement\b", re.I)),
    ("flooding", re.compile(r"\bflood(ing|ed)\b", re.I)),
    ("spraying everywhere", re.compile(r"\bspraying\s+everywhere\b|\bwater\s+everywhere\b|\bspraying\s+water\b", re.I)),
    ("burst pipe", re.compile(r"\bburst\s+pipe(s)?\b|\bpipe\s+burst\b|\bpipe\s+exploded\b", re.I)),
    ("sewage backup", re.compile(r"\bsewage\s+back(ing|ed)?\s*up\b|\bsewer\s+back(ing|ed)?\s*up\b|\bsewage\b", re.I)),
    ("no water", _NO_WATER_BASIC_PATTERN),
    ("cannot shut off water", re.compile(r"can'?t\s+shut\s+off\s+(the\s+)?water|main\s+valve\s+(broken|stuck|won'?t)", re.I)),
    ("frozen pipe", re.compile(r"\bfrozen\s+pipe(s)?\b|\bpipe(s)?\s+(are\s+)?frozen\b", re.I)),
]

# Soft urgency phrases. By themselves they do NOT escalate to emergency
# (everyone claims urgency). They flip ``customer_claimed_emergency`` and
# trigger ``needs_clarification`` if no hard signal also matched.
_SOFT_URGENCY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("asap", re.compile(r"\basap\b", re.I)),
    ("right now", re.compile(r"\bright\s+now\b", re.I)),
    ("right away", re.compile(r"\bright\s+away\b", re.I)),
    ("immediately", re.compile(r"\bimmediately\b", re.I)),
    ("urgent", re.compile(r"\burgent(ly)?\b", re.I)),
    ("emergency word", re.compile(r"\bemergenc(y|ies)\b", re.I)),
    ("need someone soon", re.compile(r"\bneed\s+someone\s+(soon|today|now)\b|\bneed\s+help\s+(soon|today|now)\b", re.I)),
]

# Priority signals. Continue normal intake but flag for follow-up.
_PRIORITY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("no hot water", re.compile(r"\bno\s+hot\s+water\b", re.I)),
    ("hot water tank stopped", re.compile(r"\bhot\s+water\s+(tank|heater)\b.*\b(stopped|broken|not\s+working|died|out)\b", re.I)),
    ("hot water not working", re.compile(r"\bhot\s+water\b.*\bnot\s+working\b", re.I)),
    ("contained leak", re.compile(r"\b(contained|small|minor|slow)\s+leak\b|\bleak\b.*\b(contained|not\s+spreading)\b", re.I)),
    ("dripping", re.compile(r"\b(dripping|drip)\b", re.I)),
    ("slow drain getting worse", re.compile(r"\bslow\s+drain\b.*\b(worse|worsening|backing\s+up)\b|\bdrain\b.*\b(getting\s+worse|backing\s+up)\b", re.I)),
    ("toilet not working", re.compile(r"\btoilet\b.*\b(not\s+working|won'?t\s+flush|broken|clogged)\b", re.I)),
    ("within 24 48 hours", re.compile(r"\bwithin\s+(24|48|24-48|24\s*to\s*48)\s*hours?\b", re.I)),
    ("today or tomorrow", re.compile(r"\b(today|tomorrow)\b", re.I)),
    ("this week", re.compile(r"\bthis\s+week\b", re.I)),
]

# Scheduled signals. Planned, flexible timing.
_SCHEDULED_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("dishwasher reinstall", re.compile(r"\bdishwasher\b.*\b(reinstall|install|hook(\s|-)?up)\b|\b(reinstall|install)\b.*\bdishwasher\b", re.I)),
    ("faucet replacement", re.compile(r"\b(replace|replacement|new|install)\b.*\bfaucet\b|\bfaucet\b.*\b(replace|replacement|install)\b", re.I)),
    ("planned install", re.compile(r"\bplanned\s+install(ation)?\b|\bnew\s+install(ation)?\b", re.I)),
    ("renovation", re.compile(r"\b(renovat\w*|remodel\w*|reno)\b", re.I)),
    ("next week", re.compile(r"\bnext\s+week\b|\bin\s+a\s+(few|couple)\s+weeks?\b", re.I)),
    ("flexible", re.compile(r"\bflexible\b|\bno\s+rush\b|\bwhenever\s+(you|works|is\s+convenient)\b|\bwhen\s+convenient\b", re.I)),
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def classify_urgency(
    message: str,
    history: Optional[list[str]] = None,
    *,
    llm_client: Optional[LlmClient] = None,
) -> TriageResult:
    """Classify a customer message.

    The returned ``urgency_level`` is one of: ``safety_escalation``,
    ``wrong_trade_oos``, ``boundary_oos``, ``emergency``, ``priority``,
    or ``scheduled``. The convenience field ``internal_level`` exposes
    the L0 / L1 / L2 / L3 mapping used in the plumbing knowledge base.

    Args:
        message: The latest customer message.
        history: Optional list of prior customer messages, used to widen
            the text the rules scan over.
        llm_client: Optional callable invoked when no rules match. It
            must accept a single string (the message) and return a dict.
            If the dict is malformed, the function falls back to the safe
            default.

    Returns:
        A flat ``TriageResult`` dict.
    """
    if not isinstance(message, str):
        raise TypeError("message must be a string")

    haystack = message
    if history:
        haystack = "\n".join(history) + "\n" + message

    # ------------------------------------------------------------------
    # L0 safety (highest priority -- detection bias is toward L0).
    # ------------------------------------------------------------------
    safety_result = _detect_safety_escalation(haystack)
    if safety_result is not None:
        return safety_result

    # ------------------------------------------------------------------
    # L0 wrong-trade OOS.
    # ------------------------------------------------------------------
    wrong_trade_hits = _match(_WRONG_TRADE_PATTERNS, haystack)
    if wrong_trade_hits:
        return _build_wrong_trade_oos_result(wrong_trade_hits)

    # ------------------------------------------------------------------
    # L0 boundary OOS (must beat L1 emergency for "no water + neighbours").
    # ------------------------------------------------------------------
    boundary_hits = _detect_boundary_oos(haystack)
    if boundary_hits:
        return _build_boundary_oos_result(boundary_hits)

    emergency_hits = _match(_EMERGENCY_PATTERNS, haystack)
    priority_hits = _match(_PRIORITY_PATTERNS, haystack)
    scheduled_hits = _match(_SCHEDULED_PATTERNS, haystack)
    soft_urgency_hits = _match(_SOFT_URGENCY_PATTERNS, haystack)

    customer_claimed_emergency = bool(emergency_hits or soft_urgency_hits)

    # L1 hard emergency: any hard signal wins.
    if emergency_hits:
        return _build_emergency_result(emergency_hits)

    # Scheduled wins over priority only when no priority signals fire.
    if scheduled_hits and not priority_hits and not soft_urgency_hits:
        return _build_scheduled_result(scheduled_hits)

    # L2 priority: explicit priority signals.
    if priority_hits:
        return _build_priority_result(
            priority_hits + soft_urgency_hits,
            customer_claimed_emergency=customer_claimed_emergency,
            needs_clarification=bool(soft_urgency_hits),
        )

    # Soft urgency only: classify as priority, but ask the customer to
    # clarify (earliest vs standard appointment).
    if soft_urgency_hits:
        return _build_priority_result(
            soft_urgency_hits,
            customer_claimed_emergency=True,
            needs_clarification=True,
            soft_only=True,
        )

    # L3 scheduled, no priority, no soft urgency: clean scheduled.
    if scheduled_hits:
        return _build_scheduled_result(scheduled_hits)

    # No rules fired. Try LLM if provided.
    if llm_client is not None:
        llm_result = _call_llm_safely(llm_client, message)
        if llm_result is not None:
            return llm_result

    # Safe default: priority, low confidence, ask for follow-up.
    return _safe_default_result()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _match(
    patterns: list[tuple[str, re.Pattern[str]]],
    text: str,
) -> list[str]:
    """Return the labels of every pattern that matches ``text``."""
    return [label for label, pat in patterns if pat.search(text)]


def _confidence_from_hits(n: int, *, cap: float = 0.95, base: float = 0.75) -> float:
    """Crude confidence scaling: more matched signals = higher confidence,
    capped to leave room for an LLM-graded result to exceed."""
    if n <= 0:
        return 0.0
    return min(cap, base + 0.08 * (n - 1))


# ---- Safety escalation detection ----------------------------------------


def _detect_safety_escalation(haystack: str) -> Optional[TriageResult]:
    """Detect any L0 safety signal in the message.

    Returns ``None`` if no safety signal matched. The check order is:
    sewer-gas+symptoms → natural gas → water+electrical →
    sewage+vulnerable. Sewer-gas is checked first so that phrases like
    "sewer gas smell" don't accidentally trigger the natural-gas
    Enbridge script.
    """
    sewer_gas_present = bool(_SEWER_GAS_PATTERN.search(haystack))

    if sewer_gas_present and _SYMPTOM_PATTERN.search(haystack):
        return _build_safety_escalation_result(
            subtype="sewer_gas_symptoms",
            signals=["sewer gas", "symptoms reported"],
            reason="Sewer gas smell reported with physical symptoms.",
            guidance=(
                "Please open windows to ventilate the area, get everyone "
                "out of that room, and if symptoms get worse, call 911. "
                "Sewer gas can contain hydrogen sulfide, which is "
                "dangerous at higher concentrations. Jill has been "
                "alerted."
            ),
        )

    if not sewer_gas_present and _SAFETY_GAS_PATTERN.search(haystack):
        return _build_safety_escalation_result(
            subtype="gas",
            signals=["gas smell"],
            reason="Customer reports a gas smell in the home.",
            guidance=(
                "That can be dangerous - please leave the home right now, "
                "and don't touch any light switches, phones, or appliances "
                "inside. Once you're outside, call Enbridge Gas Emergency "
                "at 1-866-763-5427. If anyone is feeling dizzy, nauseous, "
                "or unwell, call 911. Jill has been alerted and will follow "
                "up to make sure you're okay."
            ),
        )

    if _SAFETY_WATER_ELECTRICAL_PATTERN.search(haystack):
        return _build_safety_escalation_result(
            subtype="water_near_electrical",
            signals=["water near electrical"],
            reason="Customer reports water close to electrical outlets, "
            "wiring, panel, or breakers.",
            guidance=(
                "Water and electricity together is dangerous - please don't "
                "touch any switches or appliances near the water. If you "
                "can safely reach your electrical panel without stepping "
                "through water, shut off the main breaker. If you can't, "
                "leave the area and call 911. Jill has been alerted."
            ),
        )

    if _SEWAGE_PATTERN.search(haystack) and _VULNERABLE_OCCUPANT_PATTERN.search(haystack):
        return _build_safety_escalation_result(
            subtype="sewage_vulnerable",
            signals=["sewage backup", "vulnerable occupant"],
            reason="Sewage backup reported with a vulnerable occupant in "
            "the home.",
            guidance=(
                "I'm sorry - that's a real health hazard, especially with "
                "a vulnerable family member in the home. Please keep "
                "everyone out of the affected area, and don't run any "
                "water until we can get there. If anyone is having "
                "symptoms - nausea, dizziness, trouble breathing - call "
                "911. Jill has been alerted and will prioritise this."
            ),
        )

    return None


def _build_safety_escalation_result(
    *,
    subtype: str,
    signals: list[str],
    reason: str,
    guidance: str,
) -> TriageResult:
    return TriageResult(
        urgency_level="safety_escalation",
        urgency_label="Safety Escalation",
        internal_level="L0_safety",
        confidence=_confidence_from_hits(len(signals), cap=0.97, base=0.9),
        reason=reason,
        recommended_action=(
            "Deliver the safety script verbatim, alert Jill for "
            "a welfare follow-up call. Do not generate a quote and do "
            f"not send a Calendly link. Subtype: {subtype}."
        ),
        customer_facing_guidance=guidance,
        requires_human_followup=True,
        continue_normal_flow=False,
        needs_clarification=False,
        customer_claimed_emergency=True,
        active_damage_confirmed=True,
        classification_source="rules",
        matched_signals=signals,
    )


# ---- Wrong-trade OOS detection ------------------------------------------


_WRONG_TRADE_REDIRECTS: dict[str, str] = {
    "pool or hot tub": "a pool / spa equipment specialist",
    "well system": "a licensed well-systems contractor",
    "septic system": "a septic-systems contractor",
    "gas boiler": "an HVAC / heating contractor with a TSSA G2 gas-fitter ticket",
    "irrigation": "an irrigation contractor",
}


def _build_wrong_trade_oos_result(signals: list[str]) -> TriageResult:
    redirect = _WRONG_TRADE_REDIRECTS.get(signals[0], "a specialist in that system")
    guidance = (
        f"I hear you - that's a real problem, but it's not something Jill's "
        f"plumber can safely work on. You'll want to call {redirect}. I'm "
        "flagging this for Jill so she can follow up and point you in the "
        "right direction if it helps."
    )
    reason = f"Detected wrong-trade signal(s): {', '.join(signals[:3])}."
    return TriageResult(
        urgency_level="wrong_trade_oos",
        urgency_label="Safety Escalation",
        internal_level="L0_oos",
        confidence=_confidence_from_hits(len(signals), cap=0.92, base=0.85),
        reason=reason,
        recommended_action=(
            "Acknowledge the customer's problem, name the correct "
            "specialist type, and flag for Jill as a referral opportunity. "
            "Do not generate a quote and do not send a Calendly link."
        ),
        customer_facing_guidance=guidance,
        requires_human_followup=True,
        continue_normal_flow=False,
        needs_clarification=False,
        customer_claimed_emergency=False,
        active_damage_confirmed=False,
        classification_source="rules",
        matched_signals=signals,
    )


# ---- Boundary OOS detection ---------------------------------------------


def _detect_boundary_oos(haystack: str) -> list[str]:
    """Return a list of boundary-OOS labels that matched in the text."""
    hits: list[str] = []
    has_neighbours = bool(_NEIGHBOURS_PATTERN.search(haystack))

    if _NO_WATER_BASIC_PATTERN.search(haystack) and has_neighbours:
        hits.append("no water + neighbours affected")

    if _LOW_PRESSURE_PATTERN.search(haystack) and has_neighbours:
        hits.append("low pressure + neighbours affected")

    if _YARD_PATTERN.search(haystack) and _YARD_SEWER_SIGN_PATTERN.search(haystack):
        hits.append("yard sewer / sinkhole signs")

    return hits


def _build_boundary_oos_result(signals: list[str]) -> TriageResult:
    guidance = (
        "Based on what you're describing, this might be a city-side issue "
        "rather than something inside your home. The fastest path is "
        "usually to call Toronto 311 first to confirm. If 311 says it's "
        "on your side of the property line, message back and Jill will "
        "send someone out for a diagnostic. I'm flagging this so she "
        "knows to keep an eye on it either way."
    )
    reason = (
        f"Detected boundary signal(s) that suggest municipal scope: "
        f"{', '.join(signals[:3])}."
    )
    return TriageResult(
        urgency_level="boundary_oos",
        urgency_label="Safety Escalation",
        internal_level="L0_oos",
        confidence=_confidence_from_hits(len(signals), cap=0.85, base=0.7),
        reason=reason,
        recommended_action=(
            "Gather symptom location, neighbours, and timing. If signals "
            "point municipal, suggest 311 first. If owner-side, offer a "
            "diagnostic visit. Do not auto-generate a quote and do not "
            "send a Calendly link until ownership of the issue is clear."
        ),
        customer_facing_guidance=guidance,
        requires_human_followup=True,
        continue_normal_flow=False,
        needs_clarification=True,
        customer_claimed_emergency=False,
        active_damage_confirmed=False,
        classification_source="rules",
        matched_signals=signals,
    )


# ---- L1 / L2 / L3 builders ----------------------------------------------


def _build_emergency_result(signals: list[str]) -> TriageResult:
    # Single short safety line for L1. Gas / electrical scenarios are now
    # handled upstream as L0 safety escalations, so we don't branch here.
    guidance = (
        "If safe, turn off your main water valve. Jill has been alerted."
    )

    reason_parts = ", ".join(signals[:3])
    return TriageResult(
        urgency_level="emergency",
        urgency_label="Emergency",
        internal_level="L1_immediate",
        confidence=_confidence_from_hits(len(signals), cap=0.95, base=0.85),
        reason=f"Detected emergency signal(s): {reason_parts}.",
        recommended_action="Alert Jill immediately and stop normal quote/booking flow.",
        customer_facing_guidance=guidance,
        requires_human_followup=True,
        continue_normal_flow=False,
        needs_clarification=False,
        customer_claimed_emergency=True,
        active_damage_confirmed=True,
        classification_source="rules",
        matched_signals=signals,
    )


def _build_priority_result(
    signals: list[str],
    *,
    customer_claimed_emergency: bool,
    needs_clarification: bool,
    soft_only: bool = False,
) -> TriageResult:
    reason_parts = ", ".join(signals[:3]) if signals else "soft urgency language"
    if soft_only:
        reason = (
            f"Customer used urgent language ({reason_parts}) but no active "
            "damage signals detected."
        )
        action = (
            "Ask customer to choose earliest-available (emergency rate) or "
            "standard appointment (regular rate)."
        )
    else:
        reason = f"Detected priority signal(s): {reason_parts}."
        action = "Continue intake and offer earliest Calendly slot or quote."

    return TriageResult(
        urgency_level="priority",
        urgency_label="Priority",
        internal_level="L2_24h_to_48",
        confidence=_confidence_from_hits(len(signals), cap=0.9, base=0.75),
        reason=reason,
        recommended_action=action,
        customer_facing_guidance=None,
        requires_human_followup=True,
        continue_normal_flow=True,
        needs_clarification=needs_clarification,
        customer_claimed_emergency=customer_claimed_emergency,
        active_damage_confirmed=False,
        classification_source="rules",
        matched_signals=signals,
    )


def _build_scheduled_result(signals: list[str]) -> TriageResult:
    reason_parts = ", ".join(signals[:3])
    return TriageResult(
        urgency_level="scheduled",
        urgency_label="Scheduled",
        internal_level="L3_more_than_48h",
        confidence=_confidence_from_hits(len(signals), cap=0.92, base=0.8),
        reason=f"Detected scheduled-work signal(s): {reason_parts}.",
        recommended_action="Continue scoping then send Calendly link.",
        customer_facing_guidance=None,
        requires_human_followup=False,
        continue_normal_flow=True,
        needs_clarification=False,
        customer_claimed_emergency=False,
        active_damage_confirmed=False,
        classification_source="rules",
        matched_signals=signals,
    )


def _safe_default_result() -> TriageResult:
    return TriageResult(
        urgency_level="priority",
        urgency_label="Priority",
        internal_level="L2_24h_to_48",
        confidence=0.4,
        reason="No emergency, priority, or scheduled signals detected; routing to priority for human follow-up.",
        recommended_action="Ask one or two scoping questions, then re-classify.",
        customer_facing_guidance=None,
        requires_human_followup=True,
        continue_normal_flow=True,
        needs_clarification=True,
        customer_claimed_emergency=False,
        active_damage_confirmed=False,
        classification_source="safe_default",
        matched_signals=[],
    )


# Whitelist of fields we will accept from an LLM response. Anything else
# is discarded.
_LLM_ALLOWED_LEVELS: set[UrgencyLevel] = {"emergency", "priority", "scheduled"}


def _call_llm_safely(llm_client: LlmClient, message: str) -> Optional[TriageResult]:
    """Call the LLM and coerce its output into a valid ``TriageResult``.

    Returns ``None`` if the LLM raises, returns a non-dict, or returns an
    unrecognised urgency level. Callers should fall back to the safe
    default in that case.

    LLMs are intentionally not trusted to assign L0 urgency. L0 must come
    from the deterministic rule layer above, so the LLM whitelist only
    covers ``emergency`` / ``priority`` / ``scheduled``.
    """
    try:
        raw = llm_client(message)
    except Exception:
        return None

    if not isinstance(raw, dict):
        return None

    level = raw.get("urgency_level")
    if level not in _LLM_ALLOWED_LEVELS:
        return None

    reason = str(raw.get("reason") or "LLM classification.")
    confidence = float(raw.get("confidence") or 0.6)
    confidence = max(0.0, min(0.99, confidence))

    if level == "emergency":
        return TriageResult(
            urgency_level="emergency",
            urgency_label="Emergency",
            internal_level="L1_immediate",
            confidence=confidence,
            reason=reason,
            recommended_action="Alert Jill immediately and stop normal quote/booking flow.",
            customer_facing_guidance="If safe, turn off your main water valve. Jill has been alerted.",
            requires_human_followup=True,
            continue_normal_flow=False,
            needs_clarification=False,
            customer_claimed_emergency=True,
            active_damage_confirmed=True,
            classification_source="llm",
            matched_signals=[],
        )
    if level == "priority":
        return TriageResult(
            urgency_level="priority",
            urgency_label="Priority",
            internal_level="L2_24h_to_48",
            confidence=confidence,
            reason=reason,
            recommended_action="Continue intake and offer earliest Calendly slot or quote.",
            customer_facing_guidance=None,
            requires_human_followup=True,
            continue_normal_flow=True,
            needs_clarification=bool(raw.get("needs_clarification", False)),
            customer_claimed_emergency=bool(raw.get("customer_claimed_emergency", False)),
            active_damage_confirmed=False,
            classification_source="llm",
            matched_signals=[],
        )
    return TriageResult(
        urgency_level="scheduled",
        urgency_label="Scheduled",
        internal_level="L3_more_than_48h",
        confidence=confidence,
        reason=reason,
        recommended_action="Continue scoping then send Calendly link.",
        customer_facing_guidance=None,
        requires_human_followup=False,
        continue_normal_flow=True,
        needs_clarification=False,
        customer_claimed_emergency=False,
        active_damage_confirmed=False,
        classification_source="llm",
        matched_signals=[],
    )
