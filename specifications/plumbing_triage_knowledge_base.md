# Plumbing Triage Knowledge Base — Residential

**Purpose:** Source content for Pipeline F5 (Plumbing Knowledge System Prompt) and F2 (Urgency Triage).
**Jurisdiction:** Ontario, Canada (GTA). Trade scope assumes a licensed P3 plumber; gas work requires a TSSA G2/G3 gas-fitter ticket, which a plumber may or may not hold — when in doubt, flag.

---

## Urgency Taxonomy

| Tier | Window | Meaning | Agent behaviour |
|------|--------|---------|-----------------|
| **L0_safety** | Right now | Safety escalation — gas, electrical risk, biohazard with vulnerable occupant. **Not a plumber dispatch.** | Stop intake. Deliver safety script with specific phone number. Confirm customer is acting on it. Flag for Jill. **Do not offer Calendly link.** |
| **L1_immediate** | Active emergency | Dispatch ASAP. Active uncontrolled water, sewage in living space, frozen pipe risk. | Offer first-step advice (e.g., "shut the main"). Flag in dashboard with red badge. Book earliest slot. |
| **L2_24h_to_48** | Within 24–48h | Urgent but contained. Customer is inconvenienced but safe. | Standard intake. Send Calendly link with note to book the earliest available slot. |
| **L3_more_than_48h** | 48h+ | Schedulable. Standard quote + booking. | Full intake including job scoping for quote generation. |

---

## Agent Tone Principles (apply across all triage)

These are non-negotiable behavioural rules for the conversation agent. They are most important at L0 and OOS, where most intake bots fail.

1. **Acknowledge before redirecting.** When a customer describes something stressful, the first sentence should validate the situation, not jump to next steps. *"That sounds frightening — let's make sure you're safe first."*
2. **Lead with the action, not the explanation.** Especially at L0, tell the customer what to do right now before explaining why.
3. **Give specific phone numbers, never categories.** *"Call Enbridge Emergency at 1-866-763-5427"* — not *"call your gas utility."*
4. **Never say "this is out of scope."** That's developer language. Say: *"This isn't something Jill can fix safely — but here's exactly who can."*
5. **Never end a conversation with the customer feeling abandoned.** Even when redirecting elsewhere, close with: *"I'm flagging this for Jill right now, and he'll follow up to make sure you got the help you needed."*
6. **At L0, confirm the customer is acting.** If you tell them to leave the house, ask *"Are you outside now?"* If no, repeat the instruction. One-shot scripts fail; confirmation loops save lives.

---

## OOS Patterns (three types, three behaviours)

| Pattern | Description | Agent behaviour | Examples |
|---------|-------------|-----------------|----------|
| **A — Safety OOS (L0)** | Not a plumber dispatch; safety escalation. | Stop intake. Deliver safety script. Confirm action. Flag for Jill. Never offer booking. | Gas smell (#9), sewage + vulnerable occupant (#3), electrical-adjacent flooding (#2) |
| **B — Wrong-trade OOS** | Real problem, wrong specialist. | Acknowledge the problem. Explain plainly. Suggest what kind of specialist to look for. Flag for Jill (referral revenue opportunity). | Pool/hot tub equipment (#44), well systems (#45), septic (#46), gas boilers (#48), irrigation (#43) |
| **C — Boundary OOS** | May be municipal vs. owner-side; not always determinable by conversation. | Gather symptoms (location, neighbours affected, timing). Make probabilistic call. Be honest if unclear; suggest checking with city first if signals point municipal, or book a diagnostic if likely owner-side. | No water (#4), low pressure (#14), discoloured water (#23), sewer line (#22) |

**L0 detection bias:** False positives cost nothing (customer hears a safety reminder). False negatives cost everything. If there is any signal of gas, electrical risk, or vulnerable occupant + biohazard — **treat as L0**. Let Jill or the contractor downgrade later. This is consistent with NFR-05; guessing "probably not a real gas leak" *is* the hallucination.

---

## Triage Protocol (per FR-03, 2–5 turns)

For each concern below:

- **⮕ Q1 — Triage question.** One open question that routes ~60% of cases by itself.
- **Q2–Q4 — Disambiguators.** Asked only if Q1 doesn't lock the tier.
- **🎯 Urgency-determining signal.** The answer that locks L0/L1/L2/L3.
- **📞 Safety script** (L0 cases only). Verbatim or near-verbatim agent response.

---

## TIER 1 — MUST-HAVE TOP 30 (90%+ of dispatch volume)

These go in the F5 system prompt verbatim with Q1 + 🎯 signal. They cover the demo scenarios and the vast majority of real-world intake.

### 1. Burst pipe / pipe spraying water
⮕ **Q1:** Is water actively spraying or pouring from a pipe right now?
- Q2: Have you shut off the main water valve?
- Q3: Where in the home — basement, wall cavity, exposed?
- 🎯 **Signal:** Active uncontrolled water → **L1_immediate**. Contained drip after shut-off → **L2_24h_to_48**.
- **First-step advice:** *"Turn off your main water shutoff valve — it's usually in the basement near where the water line enters the house. Once that's done, the leak will stop or slow significantly."*

### 2. Basement / floor flooding (plumbing source)
⮕ **Q1:** Is water still rising, or has it stopped?
- Q2: Do you know the source — a pipe, an appliance, a sewer backup, or the sump pump?
- Q3: Is the water near any electrical outlets, panels, or appliances?
- 🎯 **Signal:** Water near electrical → **L0_safety**. Rising water + unknown source → **L1_immediate**. Stopped + cleaned up → **L2_24h_to_48**.
- **📞 L0 script (electrical risk):** *"That's serious — water and electricity together is dangerous. Please don't touch any switches or appliances near the water. If you can safely reach your electrical panel without stepping through water, shut off the main breaker. If you can't, please leave the area and call your electrician or the fire department at 911. I'm flagging this for Jill right now — he'll follow up as soon as it's safe."*

### 3. Sewage backup into home
⮕ **Q1:** Is sewage coming up through a drain, toilet, or floor right now?
- Q2: Is it in living space, or only in an unfinished basement or utility area?
- Q3: Is more than one fixture affected (e.g., toilet + tub + sink)? Anyone in the home elderly, infant, or with health issues?
- 🎯 **Signal:** Sewage in living space + vulnerable occupant → **L0_safety**. Sewage in living space OR multiple fixtures → **L1_immediate** (likely main line blockage). Single fixture, contained → **L2_24h_to_48**.
- **📞 L0 script (vulnerable occupant):** *"I'm sorry — that's a real health hazard, especially with [an infant / elderly family member / someone with health issues] in the home. Please keep everyone out of the affected area. If anyone is having symptoms — nausea, dizziness, trouble breathing — call 911. Otherwise, I'm flagging this as urgent for Jill right now and he'll prioritize this. In the meantime, don't run any water in the home — it'll make the backup worse."*

### 4. No water in the home **[Boundary OOS — may be municipal]**
⮕ **Q1:** Is there no water at any tap, or only some?
- Q2: Have you checked with neighbours, or is there a notice from the city about a water shutoff?
- Q3: Have you checked that the main shutoff valve inside the home is open?
- 🎯 **Signal:** No water + neighbours also affected → **OOS-Municipal** (direct to 311). No water at this property only → **L1_immediate**. Partial / one fixture → see #12.
- **OOS response:** *"It sounds like this might be a city-side issue — when neighbours are also affected, the cause is usually the municipal supply. Please call 311 or check the City of Toronto's water service alerts page. If it turns out it's just your home, message back and Jill will get someone out. I'm flagging this so he knows to check in."*

### 5. Water heater not heating (no hot water)
⮕ **Q1:** Is the tank gas or electric, and are you getting any hot water at all?
- Q2: How old is the tank? Any water pooling at the base?
- Q3: For gas: is the pilot light out, or **do you smell gas at all?** *(If any gas smell → STOP and go to #9.)*
- 🎯 **Signal:** Any gas smell → **L0_safety** (#9). Leaking tank → **L2_24h_to_48** (replacement, not repair). No leak + cold water only + winter → **L2_24h_to_48**. No leak + summer / second bathroom available → **L3_more_than_48h**.
- **Note for quote logic:** Tanks 10+ years old → assume replacement, not repair, for cost estimate.

### 6. Water heater leaking
⮕ **Q1:** Where is the water coming from — the top of the tank, the bottom, or a connected pipe?
- Q2: How fast — a drip, a steady stream, or a puddle that's growing?
- 🎯 **Signal:** Leak from bottom of tank → **L2_24h_to_48** (tank failure, replacement). Leak from top fittings → **L3_more_than_48h** (often repairable). Active fast leak → **L1_immediate**.

### 7. Toilet overflowing
⮕ **Q1:** Is water spilling onto the floor right now, or is the toilet just running constantly?
- Q2: Have you turned the shut-off valve at the base of the toilet?
- 🎯 **Signal:** Active overflow + can't stop it → **L1_immediate**. Stopped after shut-off → **L3_more_than_48h**. Just running (wasting water, not overflowing) → see #19.
- **First-step advice:** *"There's a small valve near the floor behind the toilet — turn it clockwise until it stops. That'll stop the water from filling. Then we can sort out the cause."*

### 8. Clogged toilet (single toilet, not backing into other fixtures)
⮕ **Q1:** Is this the only toilet in the home, and have you tried a plunger?
- Q2: Is the water level rising, holding, or going down slowly?
- 🎯 **Signal:** Only toilet in home + plunger failed → **L2_24h_to_48**. Multiple toilets available → **L3_more_than_48h**. Backing into tub/sink → see #3.

### 9. Gas smell near water heater, boiler, or gas line **[Safety OOS — L0]**
⮕ **Q1:** Can you smell gas right now, even faintly?
- Q2 (only if YES, and only if customer is safe): Where in the home — near the water heater, the stove, or somewhere else? Is anyone feeling dizzy or unwell?
- 🎯 **Signal:** Any gas smell → **L0_safety**, no exceptions.
- **📞 L0 script:** *"That can be dangerous — please leave the home now, and don't use any light switches, phones, or appliances inside. Once you're outside, call Enbridge Gas Emergency at 1-866-763-5427. If anyone is feeling dizzy, nauseous, or unwell, call 911. I'm flagging this for Jill immediately — he'll follow up as soon as Enbridge has cleared things. Are you able to get outside now?"*
- **Confirmation loop:** If customer doesn't confirm they've left, repeat: *"Please get outside first — Enbridge can be on their way while you're on the line with them."*
- **Why OOS:** Most plumbers in Ontario don't hold a TSSA G2 gas-fitter ticket and cannot legally work on gas appliances.

### 10. Frozen pipes (winter)
⮕ **Q1:** Has a pipe burst, or is it just frozen with no water flow yet?
- Q2: Where is the pipe — exposed, in a wall, or in an unheated area?
- Q3: What's the outdoor temperature, and is the home heated?
- 🎯 **Signal:** Burst → #1. Frozen + no burst → **L1_immediate** (rapid thaw before burst). Heat is off in the home → **L1_immediate**.
- **First-step advice:** *"Leave the nearest tap open — that gives the water somewhere to go as it thaws. Do not use an open flame or torch to thaw it. A hair dryer on low or a space heater nearby is safe. Jill will get someone there as fast as possible."*

### 11. Kitchen sink clogged / draining slowly
⮕ **Q1:** Is the sink completely blocked, draining slowly, or backing up into another sink?
- Q2: Is there a garbage disposal involved? Any recent grease or food disposal?
- Q3: Single or double basin — is the other side also affected?
- 🎯 **Signal:** Backing into other fixtures → see #3. Single sink, fully blocked → **L2_24h_to_48**. Slow drain only → **L3_more_than_48h**.

### 12. Bathtub / shower drain clogged
⮕ **Q1:** Is water standing in the tub after a shower, or does it not drain at all?
- Q2: How long has this been getting worse — days, weeks, months?
- Q3: Is this the only bathroom in the home?
- 🎯 **Signal:** Only bathroom + fully blocked → **L2_24h_to_48**. Slow drain + alternate bathroom → **L3_more_than_48h**.

### 13. Leak under sink (kitchen or bathroom)
⮕ **Q1:** Is the leak active and dripping, or only when the tap is running?
- Q2: Is the cabinet wet, swollen, or is water reaching the floor?
- Q3: Have you turned off the shut-off valves under the sink?
- 🎯 **Signal:** Active drip + can't shut off → **L1_immediate**. Shut off + cabinet damage → **L2_24h_to_48**. Only when running + a bucket catches it → **L3_more_than_48h**.

### 14. Low water pressure (whole home or specific fixture) **[Boundary OOS — may be municipal]**
⮕ **Q1:** Is it the whole house or just one fixture?
- Q2: Did it start suddenly or get worse gradually?
- Q3: Are neighbours also reporting low pressure?
- 🎯 **Signal:** Whole house + neighbours affected → **OOS-Municipal**. Sudden + whole house → **L2_24h_to_48** (possible main line, valve, or PRV issue). Gradual + one fixture → **L3_more_than_48h** (likely aerator or cartridge).

### 15. Dishwasher install / reinstall / leak
⮕ **Q1:** Is it leaking right now, or do you need installation work?
- Q2 (install): Is the supply line and drain hookup already in place?
- Q3 (leak): Where is the water coming from — front, under, or back of the unit?
- 🎯 **Signal:** Active leak → **L2_24h_to_48**. Install with rough-ins ready → **L3_more_than_48h**.

### 16. Washing machine hookup / hose burst
⮕ **Q1:** Is a hose burst or leaking now, or is this for installation?
- Q2: Have you turned off the supply valves behind the washer?
- 🎯 **Signal:** Active burst hose → **L1_immediate**. Slow leak from hose, valves shut → **L2_24h_to_48**. Install only → **L3_more_than_48h**.

### 17. Outdoor / hose bib leak (often spring, post-winter)
⮕ **Q1:** Is the leak outside at the spigot, or inside the wall where the pipe enters?
- Q2: Did you leave a hose attached over the winter, or shut off the inside valve?
- 🎯 **Signal:** Inside-wall leak → **L1_immediate** (likely frozen-burst pipe inside wall — will flood). Outside spigot only → **L3_more_than_48h**.

### 18. Sump pump failure / basement water (no obvious plumbing leak)
⮕ **Q1:** Is your sump pit overflowing, or is the pump running constantly without lowering the water?
- Q2: Is there active rainfall or snowmelt right now?
- Q3: Do you have a battery backup, and is it working?
- 🎯 **Signal:** Overflowing + active storm → **L1_immediate**. Pump cycling without progress → **L1_immediate**. Pit dry but pump won't test → **L2_24h_to_48**.

### 19. Running toilet (wasting water, not overflowing)
⮕ **Q1:** Is the toilet running constantly, intermittently, or only after flushing?
- Q2: Can you hear water trickling into the bowl when no one has flushed?
- 🎯 **Signal:** Always **L3_more_than_48h**. Common DIY fix (flapper, fill valve), but agent should still offer to book — homeowners often want it handled.

### 20. Faucet leaking / dripping
⮕ **Q1:** Is it dripping from the spout when the tap is off, leaking from the base, or under the sink?
- Q2: Hot side, cold side, or both?
- 🎯 **Signal:** Drip from spout → **L3_more_than_48h** (cartridge / washer). Leak from base → **L2_24h_to_48** (seal). Under-sink → see #13.

### 21. Pinhole leak in copper pipe (often water chemistry)
⮕ **Q1:** Where is the pinhole — on a visible pipe, or a wet spot through drywall?
- Q2: How many leaks have you had in the last six months?
- 🎯 **Signal:** Active pinhole through drywall → **L1_immediate**. Visible + slow → **L2_24h_to_48**. Multiple in 6 months → **L2_24h_to_48** + warn that a whole-home repipe conversation is likely (site visit required for quote).

### 22. Sewer line backup / repair **[Boundary OOS — owner vs. city side]**
⮕ **Q1:** Where are you seeing the problem — inside the house, or in the yard / driveway?
- Q2: Has this happened before? Have you had a camera inspection?
- 🎯 **Signal:** Inside-house symptoms (multiple fixtures backing up) → **L2_24h_to_48** (owner-side likely). Yard sinkhole / sewage on lawn → **OOS-Municipal** (likely past property line; direct to 311). Past camera inspection naming owner-side → **L2_24h_to_48**.
- **Note for boundary OOS:** Avoid asking the customer about "the property line" — most homeowners don't know where it is. Ask about symptom location instead and let the triage infer.
- **Toronto-specific:** Owner-side replacement may qualify for the City's basement flooding subsidy program.

### 23. Discoloured water (brown, yellow, rusty) **[Boundary OOS — may be municipal]**
⮕ **Q1:** Hot side only, cold side only, or both? Whole house or one fixture?
- Q2: How long has it been happening? Any recent work in the area by the city?
- 🎯 **Signal:** Hot only → **L3_more_than_48h** (water heater). Cold + whole house + recent → **OOS-Municipal** (recommend flushing, then call 311 if persists). Cold + whole house + ongoing → **L2_24h_to_48** (possible galvanized pipe corrosion).

### 24. Sewer gas smell in the home **[partial L0 if symptoms]**
⮕ **Q1:** Which room, and is the smell constant or intermittent?
- Q2: Any unused floor drains or rarely-used bathrooms that might have a dry P-trap?
- Q3: Is anyone in the home feeling unwell — headache, nausea, dizziness?
- 🎯 **Signal:** Symptoms present → **L0_safety**. Dry trap + no symptoms → **L3_more_than_48h** (simple fix — run water in the unused drain). Persistent + no dry trap → **L2_24h_to_48** (vent stack or wax seal issue).
- **📞 L0 script (if symptoms):** *"Please open windows to ventilate, get everyone out of that room, and if symptoms get worse, call 911. Sewer gas can contain hydrogen sulfide which is dangerous at higher concentrations. I'm flagging this for Jill right now."*

### 25. Toilet rocks / leaks at base
⮕ **Q1:** Is the water on the floor only after flushing, or all the time?
- 🎯 **Signal:** Constant → **L2_24h_to_48** (wax seal / flange). After flush only → **L2_24h_to_48**. Subfloor damage risk if delayed.

### 26. Water bill spike with no visible leak **[Boundary OOS — may be city-side line]**
⮕ **Q1:** Have you watched the water meter for 30 minutes with everything in the home turned off?
- Q2: Any wet spots in the yard, driveway, or basement floor that weren't there before?
- 🎯 **Signal:** Meter moving + dry house → **L2_24h_to_48** (hidden leak, often toilet or owner-side supply line). Wet spot in yard → may be **OOS-Municipal** if on city side of property line. Meter stable → **L3_more_than_48h** (likely usage, not a leak).

### 27. Tankless water heater error code / no hot water **[may be wrong-trade OOS]**
⮕ **Q1:** What's the error code on the display, and is the unit gas or electric?
- Q2: How long since last service?
- 🎯 **Signal:** Most error codes → **L2_24h_to_48**. Gas tankless service requires G2 ticket — if the shop doesn't hold one, flag as **wrong-trade OOS** and refer to gas-fitter.

### 28. Garbage disposal jammed / not working
⮕ **Q1:** Is the disposal humming, completely silent, or leaking?
- 🎯 **Signal:** Humming (jammed) → **L3_more_than_48h**. Silent → **L3_more_than_48h** + note this may be electrical, not plumbing. Leaking → **L2_24h_to_48**.

### 29. New fixture installation (sink, faucet, toilet, bidet)
⮕ **Q1:** Are the rough-ins already in place, or does this require new water lines?
- Q2: Are you supplying the fixture, or do you need it sourced?
- 🎯 **Signal:** Existing rough-ins → **L3_more_than_48h**. New rough-ins → **L3_more_than_48h** + site visit required for quote.

### 30. Kitchen / bathroom renovation rough-in
⮕ **Q1:** Are you working with a general contractor, or coordinating trades yourself?
- Q2: Do you have permits in place, or is that part of the scope?
- 🎯 **Signal:** Always **L3_more_than_48h**. Site visit required — agent should not attempt to quote by text. Likely permit + inspection involved.

---

## TIER 2 — LONG TAIL (items 31–50)

Lower frequency but still real customer calls. **For the hackathon:** consider keeping these out of the F5 system prompt to preserve token budget and signal density. Let NFR-08's "flag for Jill" fallback catch them. Post-hackathon, add to the prompt or move to a retrieval layer (per F5 stretch).

### 31. Water hammer / banging pipes
⮕ **Q1:** Does it happen when a specific fixture turns off (washer, dishwasher)?
- 🎯 Always **L3_more_than_48h**. Likely air chamber or arrestor fix.

### 32. Cloudy / milky water
⮕ **Q1:** Does it clear from the bottom up if left in a glass for a minute?
- 🎯 Yes (air) → **L3_more_than_48h**, often resolves on its own. No (sediment) → **L2_24h_to_48**.

### 33. Strange noises from pipes (whistling, gurgling)
⮕ **Q1:** Which fixture, and when does it happen — running, draining, or idle?
- 🎯 Gurgling on drain → **L2_24h_to_48** (vent issue). Whistling → **L3_more_than_48h** (valve / PRV).

### 34. Showerhead low flow / no flow (single fixture)
⮕ **Q1:** Are other fixtures in the same bathroom also affected?
- 🎯 Only showerhead → **L3_more_than_48h** (mineral buildup). Whole bathroom → see #14.

### 35. Toilet flushes weakly / has to flush twice
⮕ **Q1:** Is the bowl filling normally before the flush?
- 🎯 Always **L3_more_than_48h**. Usually a flapper or rim-jet issue.

### 36. Sump pump install or upgrade (not failure)
⮕ **Q1:** Is your current pump dead, or are you upgrading / adding backup?
- 🎯 Dead pump + wet season → **L2_24h_to_48**. Upgrade or planned replacement → **L3_more_than_48h**.

### 37. Backwater valve install (basement flood prevention) **[partial OOS — permit]**
⮕ **Q1:** Has the city recommended this, or are you applying for a rebate?
- 🎯 Always **L3_more_than_48h**. *Note: requires GTA municipal permit; may qualify for City of Toronto subsidy. Flag for Jill to walk customer through paperwork.*

### 38. Pressure-reducing valve (PRV) failure
⮕ **Q1:** High-pressure symptoms — hammering, banging, fixtures struggling?
- 🎯 **L2_24h_to_48** (untreated, can damage other fixtures).

### 39. Recirculation pump (hot water loop) failure
⮕ **Q1:** Are you getting hot water but it takes much longer than usual?
- 🎯 **L3_more_than_48h**.

### 40. Whole-home water filter or softener — leak or failure
⮕ **Q1:** Is it leaking now, or has water quality changed?
- 🎯 Active leak → **L2_24h_to_48**. Quality change only → **L3_more_than_48h**.

### 41. Backflow preventer test / install **[partial OOS — certification]**
⮕ **Q1:** Is this a city-mandated annual test, or new install?
- 🎯 **L3_more_than_48h**. *Toronto requires a BPMSA-certified tester; confirm shop has certification before promising the work.*

### 42. Drain camera / line inspection
⮕ **Q1:** Has there been a recurring backup, or is this pre-purchase due diligence?
- 🎯 **L3_more_than_48h**. *Not all residential shops own camera equipment — confirm before promising.*

### 43. Outdoor irrigation / sprinkler plumbing **[may be wrong-trade OOS]**
⮕ **Q1:** Is this a leak, seasonal blow-out, or new install?
- 🎯 Active leak → **L2_24h_to_48**. Winterization → **L3_more_than_48h**. *Many residential plumbers don't service irrigation systems — flag for Jill if outside scope.*

### 44. Pool / hot tub plumbing **[Wrong-trade OOS for most residential plumbers]**
⮕ **Q1:** Is this for the pool equipment itself, or the supply line to the pool area?
- 🎯 Supply line on the home side → **L2_24h_to_48 / L3_more_than_48h**. Pool equipment, heater, or recirculation → **OOS — refer to pool specialist**.

### 45. Well system issues (pump, pressure tank, no water) **[Wrong-trade OOS]**
⮕ **Q1:** Are you on a well, or municipal water?
- 🎯 Well → **OOS — refer to well specialist**. *GTA core is mostly municipal; rural perimeter (Caledon, parts of Durham/York) has wells.*

### 46. Septic system issues (backup, alarm, pump-out) **[Wrong-trade OOS]**
⮕ **Q1:** Are you on septic or municipal sewer?
- 🎯 Septic → **OOS — refer to septic specialist**.

### 47. Radiant floor / hydronic heating leak **[partial Wrong-trade OOS]**
⮕ **Q1:** Where is the leak — at a manifold, a visible fitting, or somewhere in the floor itself?
- 🎯 Floor-embedded → **L2_24h_to_48** + likely specialty contractor. Manifold/fitting → **L2_24h_to_48**. *Hydronic work overlaps with HVAC; confirm shop scope.*

### 48. Gas boiler issues **[Wrong-trade OOS — TSSA G2 required]**
⮕ **Q1:** Gas or electric boiler?
- 🎯 Gas → **OOS — refer to HVAC / heating contractor with G2 ticket**. Electric → **L2_24h_to_48**.

### 49. Lead pipe replacement **[partial OOS — municipal program]**
⮕ **Q1:** Has the city tagged your service line as lead, or did testing show it?
- 🎯 **L3_more_than_48h**. *Toronto's lead pipe replacement program covers the city-side line; owner-side is owner's responsibility but eligible for rebate. Flag for Jill to brief customer on the program.*

### 50. Greywater / rainwater harvesting system **[partial Wrong-trade OOS]**
⮕ **Q1:** Is this a new install, code-compliance question, or repair on an existing system?
- 🎯 Standard plumbing repair → **L3_more_than_48h**. Install or code-compliance → site visit required; flag for Jill. *Ontario Building Code restrictions apply.*

---

## Out-of-Scope Quick-Reference (Jill flag triggers)

| Concern # | Type | Why OOS | Redirect to |
|-----------|------|---------|-------------|
| #2 (electrical risk) | Safety (L0) | Electrocution risk | Electrician / 911 |
| #3 (vulnerable + sewage) | Safety (L0) | Health hazard | 911 if symptoms |
| #4 | Boundary | May be city-side | Toronto 311 |
| #9 | Safety (L0) | TSSA G2 license required | Enbridge 1-866-763-5427 |
| #14 | Boundary | May be city-side | 311 |
| #22 | Boundary | Likely city-side if yard | 311 |
| #23 | Boundary | May be city-side | 311 |
| #24 (with symptoms) | Safety (L0) | H2S exposure | Ventilate + 911 if worsening |
| #26 (yard wet spot) | Boundary | May be city-side | 311 |
| #27 (gas tankless, no G2) | Wrong-trade | License | Gas-fitter referral |
| #37 (backwater valve permit) | Procedural | Permit + subsidy paperwork | Jill walks customer through |
| #41 (backflow cert) | Procedural | BPMSA cert required | Confirm shop certification |
| #43 (irrigation) | Wrong-trade | Specialty | Irrigation contractor |
| #44 (pool / hot tub) | Wrong-trade | Specialty | Pool service company |
| #45 (well) | Wrong-trade | Specialty | Well contractor |
| #46 (septic) | Wrong-trade | Specialty | Septic contractor |
| #48 (gas boiler) | Wrong-trade | TSSA G2 | HVAC / heating contractor |
| #49 (lead pipe) | Procedural | Municipal program | Toronto lead service replacement |
| #50 (greywater install) | Wrong-trade / Procedural | Code + specialty | Specialty contractor |

---

## Revised Demo Scenario 3 — Safety Escalation (Recommended Replacement for "Dishwasher Reinstall")

**Strategic rationale:** The current spec's three scenarios show Pipeline capturing revenue (L1, L2) and scoping scheduled work (L3). They prove the product works. A safety-escalation scenario proves the product *has values* — that it makes the right call even when the right call isn't a dispatch. This is the differentiator no competitor (Jobber, ServiceTitan, Workiz) can replicate, because they're booking software with a chatbot; Pipeline is an intake agent with judgment.

**This scenario also resolves a quiet objection in the judges' minds:** *"Does AI customer service make experiences colder?"* Watching the agent handle a gas leak with calm, specific guidance — and then watching Jill close the loop with a human follow-up call — answers that objection without it ever being asked aloud.

### Scenario script

**Customer (panicked):** *"I just got home and there's a really strong smell in the basement, I think it's gas, what do I do?"*

**Agent (immediate, calm, action-first):** *"That can be dangerous — please leave the house right now. Don't touch any light switches, phones, or appliances on your way out. Are you able to get outside?"*

**Customer:** *"Okay, I'm heading out."*

**Agent (waits for confirmation, then provides specific number):** *"Good. Once you're outside, call Enbridge Gas Emergency at 1-866-763-5427. They'll send someone immediately, and they can stay on the line with you while they're on the way. If anyone is feeling dizzy, nauseous, or unwell, call 911 first."*

**Customer:** *"I'm outside now. Calling Enbridge."*

**Agent (closing with care, not abandonment):** *"You did the right thing reaching out. I want you to know I'm flagging this for Jill right now — he won't be able to work on the gas line himself (Enbridge handles that), but he'll personally call you back within the hour to make sure you're okay and to help you figure out next steps once Enbridge has cleared the home. Stay safe."*

### What the dashboard does in parallel

- A new entry appears with **amber "Safety escalation" badge** (visually distinct from red L1 emergency badge)
- Status: *"Customer welfare follow-up needed — directed to Enbridge 1-866-763-5427"*
- Conversation transcript expandable
- Action item: *"Jill to call customer back within 1 hour to confirm welfare"*
- **No Calendly link offered. No quote generated.**

### What the demo audience sees

1. Customer types panicked message → agent responds within 3 seconds (NFR-01) with calm safety instructions
2. Agent uses specific phone numbers, confirms customer is acting, closes with personal commitment
3. Dashboard lights up with the amber Safety Escalation badge — separate from the red Emergency badge from Demo 1
4. Presenter pivots: *"And here's where the human stays in the loop"* → Jill (or simulated outbound) calls the customer back to confirm welfare
5. Closing line for the pitch: *"Every other intake tool would have either booked this as a regular call or dropped the customer entirely. Pipeline did the right thing — and Jill's customer will remember that forever."*

### Why gas leak vs. other L0 scenarios for the demo

- **Unambiguous safety logic** — no "vulnerable occupant" judgment call to defend on stage
- **Named real-world third party** (Enbridge) — makes the agent feel grounded and responsible, not generic
- **Universally relatable** — every adult judge has a childhood memory of being told what to do if they smelled gas; the emotional resonance is built-in
- **Clean visual separation** between L0 (amber) and L1 (red) on the dashboard tells the product story without needing narration

### Build cost estimate

If the dashboard already handles L1 with a red badge, adding L0 amber badge styling is roughly 30 minutes of frontend work. The scenario script itself is a system-prompt addition (no new code). The "Jill calls back" portion can be simulated for the demo with a pre-recorded video or a teammate playing Jill on a real phone — no real outbound-call infrastructure needed for the hackathon.

---

## Integration Notes for F2 / F5 Implementation

1. **F5 (system prompt):** Items #1–30 with Q1 + 🎯 signal go in the prompt verbatim. The Tone Principles section should be near the top of the prompt — it shapes every response, not just L0 ones. Items #31–50 can be a condensed "if customer mentions X, route to L#" mapping or deferred to NFR-08 fallback.

2. **F2 (triage logic):** The 🎯 signal lines are the urgency classifier inputs. Extract into structured JSON for the triage sub-agent rather than relying on the LLM to infer from prose. Consider one entry per concern with `{triage_q, disambiguators[], signals[{condition, tier}]}`.

3. **L0 dashboard treatment:** L0 must render differently than L1. No Calendly link offered. Amber "Safety escalation" badge with "Customer welfare follow-up needed — directed to [Enbridge / 911 / electrician]." This is the dashboard UX piece that turns a liability into a brand moment.

4. **L0 detection bias:** Tune the classifier toward L0 sensitivity. A false positive costs nothing; a false negative is catastrophic.

5. **L0 confirmation loop:** Build the agent loop so it tracks whether the customer has confirmed they're acting on the safety instruction. Don't move on until they confirm, or two retries have passed and Jill is alerted to call. **Minimum viable version if time-constrained:** detect L0 → send script → flag for Jill → don't wait for confirmation. That covers liability. The confirmation loop is the "great" version; the immediate-flag is the "good enough" version. Don't let it block shipping.

6. **Wrong-trade OOS as referral revenue:** Pattern B OOS calls aren't waste — they're a referral network opportunity. Build the Jill-flag with a "refer to: ___" field so Jill can develop partner relationships and earn referral fees over time. The spec doesn't address this; worth raising with the team post-hackathon.

7. **Cost ranges (spec gap):** F4 requires cost ranges in the quote. This document doesn't include them because guessing GTA plumber pricing without data is the kind of hallucination NFR-05 forbids. Someone on the team needs to source these — likely the contractor persona owner (spec Open Question #4).
