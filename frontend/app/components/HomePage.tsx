import Link from "next/link";

const CARDS = [
  {
    href: "/customer-mic",
    label: "Call Jill",
    icon: "ti ti-phone-call",
  },
  {
    href: "/chat",
    label: "Chat with Jill",
    icon: "ti ti-message-circle",
  },
  {
    href: "/target",
    label: "Jill dashboard (mobile)",
    icon: "ti ti-device-mobile",
  },
  {
    href: "/dashboard",
    label: "Jill dashboard (desktop)",
    icon: "ti ti-layout-dashboard",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <style>{`
        .pipeline-home {
          max-width: 720px;
          margin: 0 auto;
          padding: 2rem 1rem 3rem;
          height: 100%;
          overflow-y: auto;
          box-sizing: border-box;
        }
        .pipeline-home-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.35rem;
        }
        .pipeline-home-header img { width: 120px; height: auto; }
        .pipeline-home-subtitle {
          margin: 0;
          font-size: 0.9rem;
          color: #6b7280;
        }
        .pipeline-home-tagline {
          margin: 1.5rem 0 1.25rem;
          text-align: center;
          font-size: 1.15rem;
          color: #111827;
          line-height: 1.4;
        }
        .pipeline-home-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.85rem;
        }
        .pipeline-home-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.55rem;
          padding: 1rem 1.1rem;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: white;
          color: #111827;
          text-decoration: none;
          transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
          min-height: 92px;
        }
        .pipeline-home-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(17, 24, 39, 0.08);
          border-color: #c7d2fe;
        }
        .pipeline-home-card-icon {
          font-size: 1.45rem;
          color: #1d4ed8;
          line-height: 1;
        }
        .pipeline-home-card-label {
          font-size: 1rem;
          font-weight: 600;
        }
        .pipeline-home-docs {
          margin-top: 1.5rem;
          text-align: center;
        }
        .pipeline-home-docs a {
          color: #6b7280;
          font-size: 0.9rem;
          text-decoration: none;
        }
        .pipeline-home-docs a:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }
      `}</style>

      <div className="pipeline-home">
        <header className="pipeline-home-header">
          <img
            src="/branding/pipe-dreams-by-jill-mark.svg"
            alt="Pipe Dreams"
          />
          <p className="pipeline-home-subtitle">by Team 17 — Pipeline Team</p>
        </header>

        <p className="pipeline-home-tagline">
          You are in need of a plumber? Call Jill!
        </p>

        <div className="pipeline-home-grid">
          {CARDS.map((card) => (
            <Link key={card.href} href={card.href} className="pipeline-home-card">
              <i className={`${card.icon} pipeline-home-card-icon`} aria-hidden />
              <span className="pipeline-home-card-label">{card.label}</span>
            </Link>
          ))}
        </div>

        <div className="pipeline-home-docs">
          <Link href="/project-documentation">Documentation →</Link>
        </div>
      </div>
    </>
  );
}
