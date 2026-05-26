import type { SlotOffer } from "./types";

export default function SlotButtons({
  slots,
  onPick,
  disabled,
}: {
  slots: SlotOffer[];
  onPick: (slot: SlotOffer) => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
        margin: "0.6rem 0",
      }}
    >
      {slots.map((s) => (
        <button
          key={s.slot_id}
          onClick={() => onPick(s)}
          disabled={disabled}
          style={{
            padding: "0.55rem 0.95rem",
            borderRadius: 8,
            border: "1px solid #2563eb",
            background: disabled ? "#e5e7eb" : "white",
            color: disabled ? "#6b7280" : "#1d4ed8",
            cursor: disabled ? "default" : "pointer",
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
