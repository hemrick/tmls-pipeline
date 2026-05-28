import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

const DEMO_CALENDLY = "https://calendly.com/pipe-dreams-by-jill/consultation";

export default function DashboardPage() {
  const apiUrl = process.env.API_URL ?? "http://localhost:8000";
  const calendlyUrl = process.env.CALENDLY_SCHEDULING_URL ?? DEMO_CALENDLY;
  return <DashboardClient apiUrl={apiUrl} calendlyUrl={calendlyUrl} />;
}
