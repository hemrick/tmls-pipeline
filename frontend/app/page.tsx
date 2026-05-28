import BrandedLayout from "./components/BrandedLayout";
import CustomerChat from "./components/CustomerChat";

export const dynamic = "force-dynamic";

export default function Page() {
  const apiUrl = process.env.API_URL ?? "http://localhost:8000";
  return (
    <BrandedLayout>
      <CustomerChat apiUrl={apiUrl} />
    </BrandedLayout>
  );
}
