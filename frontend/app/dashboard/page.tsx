import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const apiUrl = process.env.API_URL ?? "http://localhost:8000";
  return <DashboardClient apiUrl={apiUrl} />;
}
