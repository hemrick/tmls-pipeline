"use client";

import { useEffect, useState } from "react";

import { renderMarkdown } from "./markdown";

type DocSummary = { slug: string; title: string };
type DocSection = {
  id: string;
  title: string;
  audience: string | null;
  docs: DocSummary[];
};
type DocDetail = { slug: string; title: string; content: string };

export default function DocumentationClient({ apiUrl }: { apiUrl: string }) {
  const [sections, setSections] = useState<DocSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contents, setContents] = useState<Record<string, DocDetail>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/api/docs`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setSections(data.sections ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? "Failed to load documentation index");
      });
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  async function toggle(slug: string) {
    const isOpen = !!open[slug];
    if (isOpen) {
      setOpen((prev) => ({ ...prev, [slug]: false }));
      return;
    }
    setOpen((prev) => ({ ...prev, [slug]: true }));
    if (loadingSlug === slug) return;
    setLoadingSlug(slug);
    try {
      const res = await fetch(`${apiUrl}/api/docs/${slug}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DocDetail = await res.json();
      setContents((prev) => ({ ...prev, [slug]: data }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setContents((prev) => ({
        ...prev,
        [slug]: {
          slug,
          title: slug,
          content: `**Failed to load document:** ${message}`,
        },
      }));
    } finally {
      setLoadingSlug(null);
    }
  }

  const isEmpty = sections && sections.every((s) => s.docs.length === 0);

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        background: "#f3f4f6",
        padding: "2rem 1rem",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <header style={{ marginBottom: "1.5rem" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "1.75rem",
              color: "#111827",
              fontWeight: 700,
            }}
          >
            Project documentation
          </h1>
          <p style={{ marginTop: "0.5rem", color: "#4b5563" }}>
            Click a title to expand the document.
          </p>
        </header>

        {error && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              borderRadius: 6,
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        {!sections && !error && <p style={{ color: "#6b7280" }}>Loading…</p>}

        {isEmpty && (
          <p style={{ color: "#6b7280" }}>
            No documents yet. Add markdown files under{" "}
            <code>backend/documentations/</code>.
          </p>
        )}

        {sections?.map((section) =>
          section.docs.length === 0 ? null : (
            <section key={section.id} style={{ marginBottom: "2rem" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {section.title}
              </h2>
              {section.audience && (
                <p
                  style={{
                    margin: "0.25rem 0 1rem",
                    color: "#6b7280",
                    fontStyle: "italic",
                    fontSize: "0.9rem",
                  }}
                >
                  {section.audience}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {section.docs.map((doc) => {
                  const isOpen = !!open[doc.slug];
                  const detail = contents[doc.slug];
                  return (
                    <article
                      key={doc.slug}
                      style={{
                        background: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        overflow: "hidden",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(doc.slug)}
                        aria-expanded={isOpen}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          padding: "0.9rem 1.1rem",
                          background: isOpen ? "#f9fafb" : "white",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                          fontSize: "1.05rem",
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        <span>{doc.title}</span>
                        <span
                          aria-hidden
                          style={{
                            display: "inline-block",
                            transition: "transform 0.15s ease",
                            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                            color: "#6b7280",
                            fontSize: "1rem",
                          }}
                        >
                          ▶
                        </span>
                      </button>
                      {isOpen && (
                        <div
                          style={{
                            padding: "1rem 1.25rem 1.5rem",
                            borderTop: "1px solid #e5e7eb",
                          }}
                        >
                          {!detail && loadingSlug === doc.slug && (
                            <p style={{ color: "#6b7280" }}>Loading…</p>
                          )}
                          {detail && (
                            <div
                              className="doc-html"
                              dangerouslySetInnerHTML={{
                                __html: renderMarkdown(detail.content),
                              }}
                            />
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ),
        )}
      </div>

      <style>{`
        .doc-html { color: #1f2937; line-height: 1.6; font-size: 0.97rem; }
        .doc-html h1 { font-size: 1.6rem; margin: 0 0 0.75rem; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.4rem; }
        .doc-html h2 { font-size: 1.3rem; margin: 1.5rem 0 0.6rem; color: #111827; }
        .doc-html h3 { font-size: 1.1rem; margin: 1.2rem 0 0.5rem; color: #111827; }
        .doc-html h4 { font-size: 1rem; margin: 1rem 0 0.4rem; color: #111827; }
        .doc-html p { margin: 0.6rem 0; }
        .doc-html ul, .doc-html ol { margin: 0.5rem 0 0.8rem 1.5rem; padding: 0; }
        .doc-html li { margin: 0.2rem 0; }
        .doc-html code { background: #f3f4f6; padding: 0.1rem 0.35rem; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.88em; color: #1f2937; }
        .doc-html pre { background: #0f172a; color: #e2e8f0; padding: 0.9rem 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.85rem; line-height: 1.5; }
        .doc-html pre code { background: transparent; color: inherit; padding: 0; }
        .doc-html a { color: #1d4ed8; text-decoration: underline; }
        .doc-html strong { font-weight: 600; }
        .doc-html em { font-style: italic; }
        .doc-html blockquote { margin: 0.8rem 0; padding: 0.4rem 0.9rem; border-left: 3px solid #d1d5db; color: #4b5563; background: #f9fafb; }
        .doc-html hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.2rem 0; }
        .doc-html table { border-collapse: collapse; margin: 0.8rem 0; width: 100%; font-size: 0.92rem; }
        .doc-html th, .doc-html td { border: 1px solid #e5e7eb; padding: 0.45rem 0.7rem; text-align: left; vertical-align: top; }
        .doc-html th { background: #f9fafb; font-weight: 600; }
      `}</style>
    </div>
  );
}
