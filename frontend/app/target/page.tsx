export const dynamic = "force-dynamic";

import TargetClient from "./TargetClient";

export default function TargetPage() {
  const apiUrl = process.env.API_URL ?? "http://localhost:8000";
  return <TargetClient apiUrl={apiUrl} />;
}
