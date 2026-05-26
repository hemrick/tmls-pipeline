# Triage L0 Update Notes

Owner: Joe (E9), content from Calen
Last updated: 2026-05-26

This note explains how Calen's residential plumbing triage knowledge base
(`plumbing_triage_knowledge_base.md`) lands in Pipeline's existing
backend code and UI. It also captures the team's decision on terminology.

---

## Terminology: two vocabularies, one classifier

The dashboard and chat surfaces should read in plain language. The backend
code, logs, and analytics should use the structured tier names from the KB.

| UI label (customer + dashboard) | Internal level         | OOS subtype       | Trigger summary                                                       | Quote? | Calendly? |
|----------------------------------|------------------------|-------------------|-----------------------------------------------------------------------|--------|-----------|
| **Safety Escalation**            | `L0_safety`            | `safety`          | Gas smell, water near electrical, sewage + vulnerable occupant         | No     | No        |
| **Safety Escalation**            | `L0_oos`               | `wrong_trade`     | Pool / hot tub, well, septic, gas boiler, irrigation                  | No     | No        |
| **Safety Escalation**            | `L0_oos`               | `boundary`        | No water + neighbours, low pressure + neighbours, yard sewer signs    | After diagnosis | After diagnosis |
| **Emergency**                    | `L1_immediate`         | —                 | Active uncontrolled water, sewage in living space, frozen pipe risk    | After site visit | Yes (earliest) |
| **Priority**                     | `L2_24h_to_48`         | —                 | Urgent but contained (e.g. no hot water, contained leak)              | Sometimes | Yes (earliest) |
| **Scheduled**                    | `L3_more_than_48h`     | —                 | Planned work, flexible timing                                          | Yes (after scoping) | Yes |

**Rule of thumb:**

- The UI groups the three L0 subtypes under a single **Safety Escalation**
  badge (amber). The detail panel reveals the subtype and the specific
  safety / redirect guidance.
- The classifier's `urgency_level` field exposes the subtype:
  `safety_escalation`, `wrong_trade_oos`, `boundary_oos`. The convenience
  field `internal_level` is one of `L0_safety`, `L0_oos`,
  `L1_immediate`, `L2_24h_to_48`, `L3_more_than_48h`.

---

## L0 behaviour rules (every subtype)

For any classification in the L0 family:

1. **No quote.** E11 must not generate a draft quote for an L0 conversation.
2. **No Calendly link.** E10 returns `booking_method = "manual_emergency"`
   with `scheduling_url = null`. The dashboard renders the L0 booking
   override message instead of the Calendly card.
3. **Customer-facing safety guidance.** Specific phone numbers and named
   third parties, not categories. Examples:
   - Gas: *"Call Enbridge Gas Emergency at 1-866-763-5427."*
   - Electrical-adjacent flooding: *"Shut off the main breaker if you can
     reach it safely. Call 911 if anyone is in danger."*
   - Sewage + vulnerable occupant: *"Keep everyone out of the affected
     area. Call 911 if anyone has symptoms."*
4. **Customer confirmation loop (minimum viable).** Detect L0 → send
   script → flag for Jill. The "great" version adds a
   confirmation prompt (*"Are you outside now?"*) and re-asks if the
   customer doesn't confirm; out of MVP scope but documented in the KB.
5. **Mandatory human follow-up.** Dashboard tile lights up amber. Jill
   calls the customer back within the agreed SLA (target: 1 hour for
   safety; same business day for wrong-trade / boundary).
6. **Distinct close state.** Conversations close with status
   `closed_safety_escalation` after Jill follows up — separate from
   `closed_no_action` (wrong number, out of area, etc.).

---

## Subtype-specific behaviour

### `safety_escalation` (L0 — safety)

Triggers (from the KB):

- Gas smell anywhere in the home (KB #9)
- Basement flooding with water near electrical (KB #2)
- Sewage backup with vulnerable occupant (KB #3)
- Sewer gas smell with reported symptoms (KB #24)

Agent script: Calen's verbatim scripts from the KB. Always includes
the specific third-party phone number. Never DIY repair advice.

### `wrong_trade_oos` (L0 — real problem, wrong specialist)

Triggers (from the KB):

- Pool / hot tub equipment (KB #44) → pool specialist
- Well systems (KB #45) → well contractor
- Septic systems (KB #46) → septic contractor
- Gas boiler (KB #48) → HVAC contractor with TSSA G2 ticket
- Outdoor irrigation / sprinkler (KB #43) → irrigation contractor
- Tankless gas water heater if shop lacks G2 (KB #27) → gas-fitter

Agent behaviour: acknowledge the problem, explain plainly why it's not
this trade, suggest the specialist type. Flag for Jill as a *referral
opportunity* — there is referral revenue here, not just a redirect.

### `boundary_oos` (L0 — may be municipal vs. owner-side)

Triggers (from the KB):

- No water at this property + neighbours also affected (KB #4)
- Whole-house low pressure + neighbours affected (KB #14)
- Discoloured water + recent city work or neighbours affected (KB #23)
- Sewer line + yard sinkhole / sewage on lawn (KB #22)
- Water-bill spike + wet spot in yard (KB #26)

Agent behaviour: gather symptoms (location, neighbours, timing). If
signals point municipal, suggest 311 first. If signals point owner-side,
offer a diagnostic visit. Be honest if it's unclear; let Jill make the
call.

---

## Detection bias (deliberate)

The KB calls for tuning the classifier toward L0 sensitivity. The
rationale:

- A false positive at L0 costs nothing — the customer hears a safety
  reminder and learns Jill's number.
- A false negative at L0 can be catastrophic.

In practice this means: if there is any signal of gas, electrical risk,
or vulnerable occupant + biohazard, the classifier returns L0. Jill or
the orchestrator can downgrade later if the follow-up call reveals it
was actually L1 / L2 / L3.

This is consistent with NFR-05 (no hallucination on safety facts).
"Probably not a real gas leak" is the hallucination we are forbidden
from making.

---

## Examples used by the test suite

The pytest suite in `backend/tests/test_triage.py` covers:

| Test                                | Input phrase (sanitized)                                            | Expected `urgency_level`  |
|-------------------------------------|---------------------------------------------------------------------|---------------------------|
| safety — gas smell                  | "I smell gas in the basement."                                       | `safety_escalation`       |
| safety — water near electrical      | "Water is near the electrical outlet on the wall."                   | `safety_escalation`       |
| safety — sewage + vulnerable        | "Sewage is backing up into the bathroom, my baby is in the home."    | `safety_escalation`       |
| safety — sewer gas + symptoms       | "There's a sewer gas smell and I feel dizzy."                        | `safety_escalation`       |
| wrong_trade — pool equipment        | "My hot tub equipment is leaking."                                   | `wrong_trade_oos`         |
| wrong_trade — well pump             | "We're on a well and the well pump stopped."                         | `wrong_trade_oos`         |
| wrong_trade — septic                | "Our septic tank is backing up."                                     | `wrong_trade_oos`         |
| wrong_trade — gas boiler            | "Our gas boiler isn't firing."                                       | `wrong_trade_oos`         |
| wrong_trade — irrigation            | "I need irrigation system winterization."                            | `wrong_trade_oos`         |
| boundary — no water + neighbours    | "We have no water, and the neighbours also have no water."           | `boundary_oos`            |
| boundary — low pressure + neighbours| "Low water pressure across the whole street."                        | `boundary_oos`            |
| boundary — yard + sewer             | "There's a sinkhole in the front yard above the sewer line."         | `boundary_oos`            |
| L1 sanity — no water alone          | "I have no water at all in the house."                               | `emergency`               |
| L1 sanity — burst pipe              | "There's a burst pipe under the kitchen sink."                       | `emergency`               |

---

## What changed vs the previous E9 behaviour

Before this update:

- `urgency_level` was one of `emergency` / `priority` / `scheduled`.
- Gas smell and water-near-electrical phrases classified as `emergency`.
- All emergencies were treated the same on the dashboard (red badge).

After this update:

- `urgency_level` adds three L0 values: `safety_escalation`,
  `wrong_trade_oos`, `boundary_oos`.
- Gas smell and water-near-electrical now classify as
  `safety_escalation` (L0). Their `customer_facing_guidance` text is
  unchanged (still the specific phone numbers).
- All other emergencies (burst pipe, basement flooding without
  electrical, sewage without vulnerable occupant, no water alone)
  remain `emergency` (L1) — no change.
- Pytest cases for the affected paths were updated to reflect the new
  classification. All other existing tests stayed green.

---

## Hand-off to other epics

| Epic | Change                                                                                  |
|------|-----------------------------------------------------------------------------------------|
| E10  | When `urgency_level` is any L0 value, return `booking_method = "manual_emergency"` with `scheduling_url = null`. No change to L1 / L2 / L3 behaviour. |
| E11  | When `urgency_level` is any L0 value, do not call `generate_quote_draft`. No change otherwise. |
| D3   | Add the amber **Safety Escalation** badge. The dashboard tile counts all three L0 subtypes. The conversation detail panel shows the subtype + the specific safety / redirect guidance from the triage result. |
| Orchestrator (E2) | On L0, deliver the `customer_facing_guidance` verbatim, then alert Jill. Minimum viable version skips the confirmation loop; great version adds it later. |
