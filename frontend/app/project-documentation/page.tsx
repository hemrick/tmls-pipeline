import DocumentationClient from "./DocumentationClient";

export const dynamic = "force-dynamic";

export default function ProjectDocumentationPage() {
  const apiUrl = process.env.API_URL ?? "http://localhost:8000";
  return <DocumentationClient apiUrl={apiUrl} />;
}
