export const C = {
  bgPage: "#F7F6F2",
  bgSurface: "#FFFFFF",
  bgSecondary: "#F1EFE8",
  textPrimary: "#1A1A1A",
  textSecondary: "#5F5E5A",
  textTertiary: "#888780",
  borderLight: "rgba(0,0,0,0.08)",
  borderMid: "rgba(0,0,0,0.15)",
  navy: "#21295C",
  navyDark: "#042C53",
  l0Fill: "#FAEEDA", l0Stroke: "#BA7517", l0Text: "#633806", l0Deep: "#412402",
  l1Fill: "#FCEBEB", l1Stroke: "#A32D2D", l1Text: "#791F1F", l1Deep: "#501313",
  l2Fill: "#E6F1FB", l2Stroke: "#185FA5", l2Text: "#0C447C", l2Deep: "#042C53",
  l3Fill: "#F1EFE8", l3Stroke: "#888780", l3Text: "#444441",
  greenFill: "#EAF3DE", greenStroke: "#3B6D11", greenText: "#27500A", greenDeep: "#173404",
} as const;

// Maps backend urgency → visual tier
export function urgencyColors(urgency: "emergency" | "priority" | "scheduled" | null | undefined) {
  switch (urgency) {
    case "emergency": return { fill: C.l1Fill, stroke: C.l1Stroke, text: C.l1Text, deep: C.l1Deep };
    case "priority":  return { fill: C.l2Fill, stroke: C.l2Stroke, text: C.l2Text, deep: C.l2Deep };
    default:          return { fill: C.l3Fill, stroke: C.l3Stroke, text: C.l3Text, deep: C.l3Text };
  }
}
