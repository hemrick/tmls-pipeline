export const dynamic = "force-static";

export default function TargetPage() {
  return (
    <iframe
      src="/jill-target.html"
      title="Dashboard Jill Cible"
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        display: "block",
      }}
    />
  );
}
