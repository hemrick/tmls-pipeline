import CustomerChat from "../components/CustomerChat";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  const apiUrl = process.env.API_URL ?? "http://localhost:8000";
  return <CustomerChat apiUrl={apiUrl} />;
}
