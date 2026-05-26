import CustomerChat from "./components/CustomerChat";

// Read API_URL at request time so the backend URL can change without
// rebuilding the image — it's a runtime env var on Cloud Run.
export const dynamic = "force-dynamic";

export default function Page() {
  const apiUrl = process.env.API_URL ?? "http://localhost:8000";
  return <CustomerChat apiUrl={apiUrl} />;
}
