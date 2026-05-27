/** Design tokens — mirrors the CSS variables in jill-target.html */
export const C = {
  bgPage:      "#F7F6F2",
  bgSurface:   "#FFFFFF",
  bgSecondary: "#F1EFE8",
  textPrimary:   "#1A1A1A",
  textSecondary: "#5F5E5A",
  textTertiary:  "#888780",
  borderLight: "rgba(0,0,0,0.08)",
  borderMid:   "rgba(0,0,0,0.15)",
  navy:        "#21295C",
  navyDark:    "#042C53",
  // L0 — safety escalation (amber)
  l0Fill:   "#FAEEDA",
  l0Stroke: "#BA7517",
  l0Text:   "#633806",
  l0Deep:   "#412402",
  // L1 — emergency (red)
  l1Fill:   "#FCEBEB",
  l1Stroke: "#A32D2D",
  l1Text:   "#791F1F",
  l1Deep:   "#501313",
  // L2 — priority (blue)
  l2Fill:   "#E6F1FB",
  l2Stroke: "#185FA5",
  l2Text:   "#0C447C",
  l2Deep:   "#042C53",
  // L3 — scheduled (neutral grey)
  l3Fill:   "#F1EFE8",
  l3Stroke: "#888780",
  l3Text:   "#444441",
  // Green — booked / approved
  greenFill:   "#EAF3DE",
  greenStroke: "#3B6D11",
  greenText:   "#27500A",
  greenDeep:   "#173404",
} as const;

export type UrgencyKey = "emergency" | "priority" | "scheduled" | "safety_escalation";

/** Returns the colour set for a given urgency level. */
export function urgencyColors(u: string | null | undefined) {
  if (u === "emergency")         return { fill: C.l1Fill, stroke: C.l1Stroke, text: C.l1Text };
  if (u === "priority")          return { fill: C.l2Fill, stroke: C.l2Stroke, text: C.l2Text };
  if (u === "safety_escalation") return { fill: C.l0Fill, stroke: C.l0Stroke, text: C.l0Text };
  return { fill: C.l3Fill, stroke: C.l3Stroke, text: C.l3Text }; // scheduled / default
}

/** Short human label for an urgency level. */
export function urgencyLabel(u: string | null | undefined): string {
  if (u === "emergency")         return "Emergency";
  if (u === "priority")          return "Priority";
  if (u === "scheduled")         return "Scheduled";
  if (u === "safety_escalation") return "Safety";
  return "—";
}

/** Short human label for a conversation status. */
export function statusLabel(s: string | null | undefined): string {
  if (s === "new")             return "New";
  if (s === "in_progress")     return "In progress";
  if (s === "quoted")          return "Quote sent";
  if (s === "booked")          return "Booked";
  if (s === "closed_done")     return "Done";
  if (s === "closed_no_action") return "No action";
  return s ?? "—";
}
