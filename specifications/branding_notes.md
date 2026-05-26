# Branding Notes — Pipeline and Pipe Dreams by Jill

Owner: Joe (E13-7 product brand, E10-5 contractor brand)
Last updated: 2026-05-26

## Brand separation

Pipeline is the product brand.

Pipe Dreams by Jill is the demo contractor brand.

Customers should feel like they are texting Pipe Dreams by Jill.
Contractors should see Pipeline as the tool powering the intake,
dashboard, triage, quote, and booking workflow.

## Product brand

- Name: Pipeline
- Role: AI intake assistant for skilled trades
- Tone: modern, reliable, operational, clear
- Suggested dashboard header: Pipeline — Pipe Dreams by Jill Dashboard
- Suggested footer: Powered by Pipeline

## Contractor brand

- Name: Pipe Dreams by Jill
- Owner/operator: Jill
- Trade: Residential plumbing
- Tone: practical, calm, safety-first, honest, neighbourly
- Important note: the name is playful, but emergency and safety
  escalation copy must stay serious.

## Logo needs

- Pipeline wordmark
- Pipe Dreams by Jill contractor logo
- Simple square mark for Calendly/profile usage
- Avoid overly cartoonish plumbing graphics

## Asset locations

- `frontend/public/branding/pipeline-mark.svg` — Pipeline product mark + wordmark (SVG)
- `frontend/public/branding/pipe-dreams-by-jill-mark.svg` — Pipe Dreams by Jill contractor mark + stacked wordmark (SVG)
- `frontend/public/branding/pipe-dreams-by-jill-square.png` (not yet created) — square mark for Calendly/profile usage

## Working brand kit

The SVGs in `frontend/public/branding/` are the final hackathon brand
assets. They are real vector files — not embedded bitmaps — with a
transparent background and no external fonts. Each one carries
`viewBox`, `role="img"`, a `<title>`, and a `<desc>` for accessibility
and crisp scaling at any dashboard or print size.

### Pipeline (product brand)

- Direction: connected node-and-pipe glyph in blue + teal, paired with
  a navy "Pipeline" wordmark to the right.
- Reads as: B2B SaaS / workflow software.

### Pipe Dreams by Jill (contractor brand)

- Direction: navy house roof outline with stylized teal pipework
  inside, a warm amber inner accent, and a pale water drop hanging
  just below the house.
- Stacked wordmark: "Pipe Dreams" in bold navy with an italic teal
  "by Jill" subtitle.
- Reads as: trustworthy, local, residential plumbing.

### Core colours

| Token              | Approx. hex | Role                                          |
|--------------------|-------------|-----------------------------------------------|
| Navy               | `#0C2C4B`   | Wordmarks, house outline, drop outline        |
| Pipeline blue      | `#3477BD`   | Pipeline pipes + blue nodes                   |
| Pipeline teal      | `#2CACA0`   | Pipeline pipes + teal nodes                   |
| Contractor teal    | `#139899`   | Pipe Dreams pipework + "by Jill" subtitle     |
| Warm amber         | `#E89C2E`   | Pipe Dreams inner accent only — use sparingly |
| Pale blue          | `#DDEBF5`   | Water drop body, soft background fills        |

Hex values are approximations of the dominant fills in the converted
SVGs; treat them as starting points if you ever need to recolour
matching UI elements.

### Usage notes

- Prefer the SVGs over rasterised exports — they scale cleanly to any
  dashboard, header, slide, or print size.
- Background must stay transparent. Do not flatten onto a coloured or
  black background; the marks are designed against page surfaces.
- Minimum height: 24px for the Pipeline mark, 64px for the Pipe
  Dreams by Jill mark (it has more interior detail).
- When the contractor logo sits above customer-facing safety copy,
  the warm amber accent is OK to keep — the surrounding copy controls
  the register.
- Do not change colours, swap palettes, or add gradients without
  updating this file first.

### Provenance

The final logo assets are based on the selected Gemini-generated logo
references that the team signed off on. Those references were
converted into vector SVG files outside the repo, then dropped into
`frontend/public/branding/` as the visual source of truth. Repo-side
cleanup was deliberately light: a `viewBox`, `role="img"`,
`aria-label`, and a `<title>` / `<desc>` block were added to each
file; path data, fills, dimensions, and text outlines were preserved
byte-for-byte from the converted SVGs. The logos are intended as
hackathon-ready brand assets — heavy compared to a hand-redrawn
wordmark, but visually faithful to the approved direction.

## Calendly profile copy

```
Pipe Dreams by Jill — residential plumbing service call. Pick the
earliest time that works for you. After you book, you'll get a
confirmation. Final pricing is confirmed on-site after inspection.
```

## Quote / email signature

```
Pipe Dreams by Jill
Residential Plumbing Services
Final pricing confirmed on-site after inspection.
```
