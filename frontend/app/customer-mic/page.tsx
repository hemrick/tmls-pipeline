import CustomerChatWithMic from "../components/CustomerChatWithMic";

export const dynamic = "force-dynamic";

export default function CustomerMicPage() {
  const apiUrl = process.env.API_URL ?? "http://localhost:8000";
  return <CustomerChatWithMic apiUrl={apiUrl} />;
}
