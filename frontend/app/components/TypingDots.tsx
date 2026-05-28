export default function TypingDots() {
  return (
    <>
      <style>{`
        @keyframes pipeline-dot {
          0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
          40%           { opacity: 1;    transform: translateY(-2px); }
        }
        .pipeline-typing {
          display: inline-flex;
          gap: 4px;
          align-items: center;
          padding: 0.4rem 0.6rem;
        }
        .pipeline-typing span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #6b7280;
          animation: pipeline-dot 1.2s infinite ease-in-out;
        }
        .pipeline-typing span:nth-child(2) { animation-delay: 0.15s; }
        .pipeline-typing span:nth-child(3) { animation-delay: 0.30s; }
      `}</style>
      <div className="pipeline-typing" aria-label="Assistant is typing">
        <span />
        <span />
        <span />
      </div>
    </>
  );
}
