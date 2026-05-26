# Pipeline -- Services Catalog
*Used to inform quote generation, system prompt, and triage questions.*
*Times are labour only. Does not include travel or parts markup.*

---

## Format

Each service entry includes:
- **Labour range** -- realistic min and max. Min assumes straightforward access and no surprises. Max assumes older home, corroded fittings, surprise discoveries.
- **Typical parts** -- what Jill usually needs. "Cannot predict" means she won't know until she sees it.
- **Questions to ask** -- what the agent should collect before generating a quote. Ordered by priority.

---

## Services

### Install dishwasher
| Field | Value |
|-------|-------|
| **Labour min** | 20 min |
| **Labour max** | 45 min |
| **Typical parts** | Usually ships with the dishwasher. May need a $10--20 drain hose extension or elbow fitting. |
| **Questions** | Do you already have a dishwasher being replaced, or is this a new install into an empty space? Is the dishwasher new or used? Do you know if it will fit the current opening (standard is 24")? Do you have an existing water supply line and drain under the sink? |

---

### Install bathroom faucet
| Field | Value |
|-------|-------|
| **Labour min** | 10 min |
| **Labour max** | 30 min |
| **Typical parts** | Often need a $5--15 supply line adapter. Braided supply lines if not included with faucet. |
| **Questions** | Do you already have the faucet, or does Jill need to source it? How many holes does your sink have (1, 2, or 3 holes)? Does the faucet you have match the hole configuration? Is the existing faucet currently working (non-urgent)? |

---

### Investigate a leak
| Field | Value |
|-------|-------|
| **Labour min** | 30 min |
| **Labour max** | 5 hours |
| **Typical parts** | Cannot predict until source is located. Investigation only -- repair quoted separately. |
| **Questions** | Is this urgent -- is water actively coming through right now? Is the water under control for now (bucket, towels)? Turn off or unplug electrical appliances near water immediately. What room is the water appearing in? What room or fixture is above it? How old is the house? When was the source room last renovated? Are there any stains or soft spots suggesting this has been happening for a while? |

---

### Stop toilet from moving / rocking
| Field | Value |
|-------|-------|
| **Labour min** | 10 min |
| **Labour max** | 45 min |
| **Typical parts** | Wax ring/seal (~$10). Toilet bolts if corroded. Shims if floor is uneven. |
| **Questions** | Which brand and model of toilet if known (helps with wax seal sizing)? Is there easy access to the floor bolts on either side of the base -- are they hidden by plastic caps? Any sign of water damage or soft flooring around the base? Has this been going on a long time (may indicate seal already failed and floor damage underneath)? |

---

### Drain unclog
| Field | Value |
|-------|-------|
| **Labour min** | 1 hour |
| **Labour max** | 5 hours |
| **Typical parts** | Cannot predict. May need drain snake, hydro-jet access, or camera inspection. |
| **Questions** | Which drain is clogged -- kitchen sink, bathroom sink, tub, floor drain, or main to street? Is this urgent -- is water backing up into the house? Stop using water appliances until Jill arrives. Turn off or unplug any electrical appliances near standing water. Do you have a backflow prevention valve installed? When did it start? How deep is standing water, if any? Have you tried anything already (plunger, drain cleaner)? |

---

### Replace water heater (tank)
| Field | Value |
|-------|-------|
| **Labour min** | 2 hours |
| **Labour max** | 4 hours |
| **Typical parts** | New tank (customer sources or Jill supplies). Flex connectors (~$20), possibly expansion tank (~$50--80), new TPR valve if needed. Copper fittings if existing connections are corroded. |
| **Questions** | Gas or electric? What size is the current tank (gallons -- usually printed on the side)? How old is the current tank? Is it leaking, or just not heating? Any rust-coloured water at the taps? Where is the tank located -- basement, utility closet, other? Easy access, or tight space? Do you want Jill to source the replacement tank, or will you supply it? |

---

### Replace shut-off valve
| Field | Value |
|-------|-------|
| **Labour min** | 30 min |
| **Labour max** | 2 hours |
| **Typical parts** | New quarter-turn ball valve ($15--40 depending on size). Compression fittings or solder depending on pipe type. |
| **Questions** | Which valve needs replacing -- under a sink, behind a toilet, at the main, or elsewhere? Is it currently leaking, stuck, or completely failed? Has this valve been turned in the last few years, or has it been untouched for a long time? What type of pipe connects to it if you know (copper, PVC, galvanized)? Is there easy access, or is it inside a wall or tight cabinet? |

---

### Outdoor hose bib / tap replacement
| Field | Value |
|-------|-------|
| **Labour min** | 30 min |
| **Labour max** | 1.5 hours |
| **Typical parts** | New frost-free hose bib ($20--45). Pipe fittings or solder if access requires it. Plumber's tape. |
| **Questions** | Is it dripping constantly, leaking at the handle, or completely broken off? Is it a frost-free (anti-siphon) model -- does it stick out from the wall further than a normal tap? Is there easy access to the interior shutoff for this bib (usually in the basement)? Any sign of water damage on the interior wall behind it? |

---

### Garbage disposal installation
| Field | Value |
|-------|-------|
| **Labour min** | 30 min |
| **Labour max** | 1 hour |
| **Typical parts** | Usually ships with the unit (mounting assembly, drain elbow, splash guard). May need a P-trap extension ($5--10) if drain connection doesn't line up. |
| **Questions** | Do you already have the disposal unit, or does Jill need to source one? Is there an existing disposal being replaced, or a new install? Is there an electrical outlet under the sink (standard 3-prong)? If replacing: what brand and model is the existing one (some brands reuse the same mount, saves time)? Any dishwasher drain connected to the current setup? |

---

### Pipe repair -- burst, pinhole, or split
| Field | Value |
|-------|-------|
| **Labour min** | 1 hour |
| **Labour max** | 6 hours |
| **Typical parts** | Cannot predict. May need couplings, pipe sections, fittings, solder, or push-fit connectors depending on pipe type and access. |
| **Questions** | Is water shut off to the affected area? Turn off the main if needed -- Jill can walk you through it. Is water still actively spraying or has it stopped? Where is the damaged pipe located -- under sink, in wall, basement ceiling, crawl space? Do you know what type of pipe it is (copper, PVC, galvanized, PEX)? How old is the house? Has this section of pipe had problems before? |

---

### Toilet not flushing / running constantly
| Field | Value |
|-------|-------|
| **Labour min** | 15 min |
| **Labour max** | 1 hour |
| **Typical parts** | Flapper ($5--10), fill valve ($15--25), or flush valve depending on diagnosis. Rarely need a full rebuild kit (~$30). |
| **Questions** | Is the toilet not flushing at all, flushing weakly, or running/filling constantly after a flush? How old is the toilet? Any visible damage inside the tank -- broken arm, deteriorated rubber parts? Has this happened before or is it new? Is it the only toilet in the home (affects urgency)? |

---

## Notes for quote generation

- **Labour ranges are for a typical home with reasonable access.** Add time for: older homes (pre-1970), high-rise condos, crawl spaces, shared walls, corroded fittings, galvanized pipe, any situation where turning off water affects the whole building.
- **"Cannot predict" on parts** means the quote should always include a caveat: "Parts will be quoted on-site once I can assess what's needed."
- **House age and last renovation** are the two most useful general questions across almost every service. Older homes = older pipes = more surprises.
- **Emergency surcharge applies** when the customer cannot wait (active leak, no water, sewage backup). Flag this in the quote.
- **This is not a guaranteed quote.** Final price confirmed on-site. Some jobs reveal additional work once the wall is open or the water is off.
