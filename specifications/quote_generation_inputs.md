# Quote Generation Inputs

Owner: Joe (E11)
Last updated: 2026-05-26

This note describes the inputs the quote-generation agent needs in order
to build a draft quote. It is informed by a sanitized review of a real
plumber's customer conversation — only patterns are captured here, no
personal information.

This is a spec document; the numbers below are placeholders. Final values
come from the contractor's real rate sheet (Jill), captured per
contractor in a `PricingProfile` record.

---

## 1. Pricing inputs (per contractor)

These should live on the contractor record (one profile per shop) and be
referenced by the quote generator at runtime.

| Input                          | Type       | Example placeholder | Notes                                                                 |
|--------------------------------|------------|---------------------|-----------------------------------------------------------------------|
| `first_hour_rate`              | currency   | `$xxx.00`           | Minimum charge for a service call. Covers the first hour on site.     |
| `additional_half_hour_rate`    | currency   | `$xx.00`            | Per half-hour after the first hour. Half-hour granularity matters — full-hour rounding inflates quotes for short jobs. |
| `truck_sundries_charge`        | currency   | `$10.00`            | Flat per-visit charge for consumables (caulk, tape, fittings, etc.).  |
| `material_markup_pct`          | percentage | `0–25%`             | Markup on plumber-supplied parts. Some shops pass through at cost.    |
| `service_area_radius_km`       | int        | `25`                | Outside this, the triage agent should flag as out-of-area.            |
| `after_hours_multiplier`       | float      | `1.0–1.5`           | Optional. Evening / weekend rate multiplier if the shop charges extra.|
| `gst_hst_pct`                  | percentage | `13`                | Ontario HST. Quotes show pre-tax + tax breakdown.                     |
| `quote_validity_days`          | int        | `30`                | How long a quote remains valid before re-confirmation is required.    |

---

## 2. Customer-supplied vs plumber-supplied materials

Every quote must distinguish between materials the customer will supply
(fixtures the homeowner chose and bought) and materials the plumber will
bring (parts, fittings, valves). This is a common source of dispute and
should always be explicit.

| Material source     | In quote total? | Note                                                       |
|---------------------|-----------------|------------------------------------------------------------|
| Plumber-supplied    | Yes             | Included as line items at cost (plus optional markup).     |
| Customer-supplied   | No              | Listed separately, with a "to be supplied by customer" tag.|

If the customer has not yet purchased the customer-supplied items, capture
`customer_to_provide_before_appointment = true` so the orchestrator can
nudge the customer ahead of the visit. Common case: replacement faucets,
dishwashers, toilets. Missing fixtures on the day of the visit causes
wasted truck time.

---

## 3. Service hour estimates by task

These are MVP starting points for rule-based drafting. **A site visit
overrides these** for any non-routine work (see section 5).

| Task category                              | Estimated hours | Default approach   |
|--------------------------------------------|-----------------|---------------------|
| Faucet replacement (existing rough-in)     | 0.5 – 1.0       | Quote               |
| Toilet repair (running, leak at base)      | 0.5 – 1.5       | Quote               |
| Toilet replacement (existing rough-in)     | 1.0 – 2.0       | Quote               |
| Dishwasher install (existing rough-in)     | 1.0 – 1.5       | Quote               |
| Hot water tank replacement                 | 2.0 – 4.0       | Quote (parts vary)  |
| Shower head replacement                    | 0.25 – 0.5      | Quote               |
| Cartridge / valve repair                   | 1.0 – 2.0       | Quote               |
| Drain unclog (single fixture)              | 0.5 – 1.5       | Quote (light) / Estimate (severe) |
| Sewer camera + inspection                  | 1.0 – 2.0       | Quote               |
| Pinhole leak repair (visible pipe)         | 1.0 – 2.0       | Estimate            |
| Pinhole leak repair (through drywall)      | Site visit      | Estimate only       |
| Sewer line dig / replacement               | Site visit      | Estimate only       |
| Renovation rough-in                        | Site visit      | Estimate only       |
| Backwater valve install                    | Site visit + permit | Estimate only   |
| Lead service line replacement (owner-side) | Site visit + permit | Estimate only   |

Total labour = `first_hour_rate` for the first hour plus
`additional_half_hour_rate` per half-hour for the remainder, rounded up to
the nearest half-hour.

---

## 4. Quote vs Estimate decision criteria

A **quote** is a fixed-range commitment. An **estimate** is a best guess
that may change once the plumber is on-site. Use whichever fits the job.

| Use a quote (fixed range)                            | Use an estimate (variable) |
|-----------------------------------------------------|----------------------------|
| Single defined task on existing rough-ins           | Multiple tasks bundled into one visit |
| Customer-supplied fixture, install only             | Unknown scope (e.g. wet drywall, pinhole leak source unclear) |
| Standard repair with predictable parts              | Permits required           |
| Job duration < 4 hours                              | Job duration > 4 hours     |
| No demolition expected                              | Demolition or digging expected |
| Customer and plumber agree on scope                 | Customer and plumber disagree on scope |

For any "estimate" classification, the customer-facing quote must include
this language:

> *"This is an estimate based on the description provided. Final pricing
> will be confirmed on-site after inspection. Additional charges may apply
> if the scope expands."*

This is in addition to the standard disclaimer Pipeline already attaches
to every quote.

---

## 5. When to require a site visit / Jill review

The agent must NOT auto-generate a quote — it must flag for Jill review
and a site visit — when any of the following are true:

- Customer mentions wet drywall, hidden leak, or stains spreading.
- Customer mentions multiple problems in different rooms (bundled job).
- Customer mentions renovation, rough-in changes, or new fixture locations.
- Customer mentions any permit-requiring work (backwater valve, sewer line
  replacement, gas line, lead service replacement).
- Customer reports a recurring problem ("third time this year").
- Customer-supplied fixture has not arrived yet AND the appointment is
  more than 5 business days out (risk of fixture arriving wrong / damaged).
- Triage outcome is `L1_immediate` and the plumber needs to assess on-site
  before committing to a price range.
- Triage outcome is any `L0_*` value — Pipeline does not quote on L0 paths
  (the conversation is a safety escalation, not a job).

---

## 6. Quote object output (E11)

The existing `Quote` object's `estimated_price_range` field is the
customer-facing range. The full breakdown should be stored on the same
object for the dashboard.

Suggested additional optional fields (post-MVP):

| Field                      | Type       | Notes                                                       |
|----------------------------|------------|-------------------------------------------------------------|
| `is_estimate_only`         | bool       | True if the quote uses the "estimate" approach (section 4). |
| `customer_supplied_items`  | string[]   | Items the customer must provide before the visit.           |
| `pricing_breakdown`        | object     | Object containing `labour_hours`, `first_hour_rate`, `additional_half_hour_rate`, `truck_sundries_charge`, `materials`, `materials_markup_pct`, `subtotal`, `hst`, `total_low`, `total_high`. |
| `site_visit_required`      | bool       | True when the quote cannot be finalised over chat.          |
| `requires_permit`          | bool       | Triggers a Jill review for permit paperwork.                |

The current MVP `Quote` only requires `estimated_price_range`,
`scope[]`, and the standard disclaimer. The fields above are forward
compatibility hooks.

---

## 7. Design notes (from sanitized real-world conversation)

These are patterns observed while reviewing a real plumber's customer
conversation. No PII appears in the repo; only the patterns:

1. **Rates are quoted conversationally, not in formatted blocks.**
   Customers re-ask for them later by email. Pipeline should always
   confirm rates in writing automatically — the formatted quote is a
   feature, not a nice-to-have.
2. **Customers add tasks during a visit ("while you're here…").** This
   is why bundled jobs should be estimates, not fixed quotes. The
   quote object should support partial fulfilment + add-ons (post-MVP).
3. **Customer-supplied fixtures often delay scheduling** when not
   delivered before the visit. Capture supply status during intake and
   nudge the customer if the appointment is approaching.
4. **Some quotes become exploratory dig-outs** as soon as the plumber is
   on-site (e.g. a clogged drain that turns out to be a collapsed sewer
   pipe). The system should support converting an in-flight quote into a
   site-visit estimate (Jill flips the status on the dashboard — post-MVP).
5. **Insurance-relevant work needs a "plumber's report"**, which is
   different from an invoice. Capturing this as a separate post-job
   artifact is a useful future feature; out of MVP scope.
6. **Permit-bearing work (e.g. backwater valve, sewer line) takes the
   contractor out of the booking loop** until the city approves. The
   quote workflow should mark these jobs as `requires_permit = true` and
   the booking flow should pause Calendly hand-off until Jill confirms
   the permit timeline.

---

## 8. Open questions for the team

These map to PROJECT_PLAN.md Open Questions (#4 contractor persona,
#5 email MVP). Surfaced here so they don't get lost.

- **Cost ranges.** The KB does not include GTA-specific cost ranges. Per
  NFR-05, the agent must not fabricate them. Someone (likely the
  contractor persona owner) must source the real numbers before the
  judges' demo.
- **Material markup.** Does Jill charge cost-plus or pass through at
  cost? Affects the pricing breakdown shown to the customer.
- **After-hours rate.** Does Jill charge an evening / weekend
  multiplier, and when does it apply (after 5 PM? weekends only?).
- **Quote validity.** How long is a quote good for? 30 days is a common
  default but should be confirmed.
- **Insurance reports.** Out of MVP scope but a real customer need.
  Worth scoping for a v2.
