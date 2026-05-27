import BrandedLayout from "../components/BrandedLayout";
import CustomerChatWithMic from "../components/CustomerChatWithMic";

export const dynamic = "force-dynamic";

export default function CustomerMicPage() {
  const apiUrl = process.env.API_URL ?? "http://localhost:8000";
  return (
    <BrandedLayout>
      <CustomerChatWithMic apiUrl={apiUrl} />
    </BrandedLayout>
  );
}
