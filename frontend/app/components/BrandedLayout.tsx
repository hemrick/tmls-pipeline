import type { ReactNode } from "react";

/**
 * Wraps customer-facing pages with the Pipe Dreams by Jill logo.
 * Desktop (>= 900px): logo floats in the left gutter beside the chat.
 * Mobile  (<  900px): logo stacks above the chat.
 */
export default function BrandedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        .branded-wrapper {
          position: relative;
          height: 100%;
        }
        .branded-logo {
          position: absolute;
          top: 28px;
          left: 32px;
          z-index: 10;
          pointer-events: none;
        }
        .branded-logo img {
          width: 200px;
          height: auto;
        }

        @media (max-width: 900px) {
          .branded-wrapper {
            display: flex;
            flex-direction: column;
            height: 100%;
          }
          .branded-logo {
            position: static;
            padding: 14px 16px 0;
            pointer-events: auto;
          }
          .branded-logo img {
            width: 160px;
          }
        }
      `}</style>
      <div className="branded-wrapper">
        <div className="branded-logo">
          <img
            src="/branding/pipe-dreams-by-jill-mark.svg"
            alt="Pipe Dreams by Jill"
          />
        </div>
        {children}
      </div>
    </>
  );
}
