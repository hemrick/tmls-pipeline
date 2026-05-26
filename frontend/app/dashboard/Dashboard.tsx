"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import "./dashboard.css";
import {
  initialState,
  quoteData as defaultQuoteData,
  sparkSeries,
  timeWindowData,
} from "./mockData";
import type {
  AccordionPeriod,
  CalendarMode,
  ConversionVariant,
  DashboardState,
  FocusedField,
  QuoteData,
  QuoteLineItem,
  RevenueVariant,
  ScreenId,
  TimeWindow,
} from "./mockData";

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function calcTotals(data: QuoteData) {
  const materialsSubtotal = data.materials.reduce((s, m) => s + (Number(m.amount) || 0), 0);
  const labourSubtotal = data.labour.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const subtotal = materialsSubtotal + labourSubtotal;
  const tax = Math.round(subtotal * data.taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { materialsSubtotal, labourSubtotal, subtotal, tax, total };
}

function fmt$(n: number) {
  const v = Number(n) || 0;
  return "$" + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getSparkData(metric: string, period: AccordionPeriod): number[] {
  return sparkSeries[`${metric}_${period}`] ?? [];
}

type SparklineOpts = { w?: number; h?: number; strokeWidth?: number; dotR?: number };

function Sparkline({
  data,
  strokeColor,
  fillColor,
  opts = {},
}: {
  data: number[];
  strokeColor: string;
  fillColor: string;
  opts?: SparklineOpts;
}) {
  if (!data.length) return null;
  const w = opts.w ?? 160;
  const h = opts.h ?? 30;
  const pad = 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const xStep = (w - pad * 2) / (data.length - 1);

  let path = "";
  let area = "";
  data.forEach((v, i) => {
    const x = pad + i * xStep;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    if (i === 0) {
      path += `M ${x} ${y}`;
      area += `M ${x} ${h - pad} L ${x} ${y}`;
    } else {
      path += ` L ${x} ${y}`;
      area += ` L ${x} ${y}`;
    }
  });
  area += ` L ${pad + (data.length - 1) * xStep} ${h - pad} Z`;

  const lastX = pad + (data.length - 1) * xStep;
  const lastY = h - pad - ((data[data.length - 1] - min) / range) * (h - pad * 2);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={area} fill={fillColor} opacity={0.5} />
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={opts.strokeWidth ?? 1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={opts.dotR ?? 2} fill={strokeColor} />
    </svg>
  );
}

// ----------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------

const SCREEN_TABS: { id: ScreenId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "callbacks", label: "Callbacks" },
  { id: "emergencies", label: "Emergencies" },
  { id: "quotes-queue", label: "Quote queue" },
  { id: "pipeline", label: "Pipeline" },
  { id: "conv-detail", label: "L0 detail" },
  { id: "calendar", label: "Calendar" },
  { id: "plumber-sms", label: "Jill's SMS" },
  { id: "quote-review", label: "Quote review" },
  { id: "customer-sms", label: "Customer SMS" },
];

export default function Dashboard() {
  const [s, setS] = useState<DashboardState>(initialState);
  const [toast, setToast] = useState<{ text: string; show: boolean }>({ text: "", show: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------- Generic updater
  const update = useCallback(<K extends keyof DashboardState>(patch: Partial<DashboardState>) => {
    setS((prev) => ({ ...prev, ...patch }));
  }, []);

  // -------- Toast
  const showToast = useCallback((text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, show: true });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 2400);
  }, []);

  // -------- Screen switching
  const setScreen = useCallback((screen: ScreenId) => {
    setS((prev) => ({
      ...prev,
      currentScreen: screen,
      timeWindowMenuOpen: false,
      conversionAccordion: screen === "today" ? prev.conversionAccordion : false,
      revenueAccordion: screen === "today" ? prev.revenueAccordion : false,
      todayJobsExpanded: screen === "today" ? prev.todayJobsExpanded : false,
      quoteMode: screen === "quote-review" ? prev.quoteMode : "review",
      quoteEdits: screen === "quote-review" ? prev.quoteEdits : null,
      showRejectModal: screen === "quote-review" ? prev.showRejectModal : false,
      focusedField: screen === "quote-review" ? prev.focusedField : null,
    }));
  }, []);

  // -------- Outside-click for time window dropdown
  useEffect(() => {
    if (!s.timeWindowMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".tw-current") && !t.closest(".tw-menu")) {
        update({ timeWindowMenuOpen: false });
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [s.timeWindowMenuOpen, update]);

  // -------- Auto-focus the tapped quote field after entering edit mode
  useEffect(() => {
    if (s.quoteMode !== "edit" || !s.focusedField) return;
    const f = s.focusedField;
    const id = f.section === "problem" ? "edit-problem" : `edit-${f.section}-${f.idx}-${f.field}`;
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el) {
      el.focus();
      if (typeof (el as HTMLInputElement).select === "function") (el as HTMLInputElement).select();
    }
  }, [s.quoteMode, s.focusedField]);

  // ====================================================================
  // SCREEN: TODAY
  // ====================================================================

  const renderTimeWindow = (): ReactNode => {
    const showArrows = s.timeWindow === "today";
    return (
      <div className="time-window">
        {showArrows ? (
          <button
            className="tw-arrow"
            onClick={() => update({ dayOffset: s.dayOffset - 1 })}
            aria-label="Previous day"
          >
            <i className="ti ti-chevron-left" />
          </button>
        ) : (
          <div style={{ width: 30 }} />
        )}
        <button
          className="tw-current"
          onClick={(e) => {
            e.stopPropagation();
            update({ timeWindowMenuOpen: !s.timeWindowMenuOpen });
          }}
        >
          <i className="ti ti-calendar-time" style={{ fontSize: 14 }} />
          <span>{timeWindowData[s.timeWindow].label(s.dayOffset)}</span>
          <i className="ti ti-chevron-down" style={{ fontSize: 14 }} />
        </button>
        {showArrows ? (
          <button
            className="tw-arrow"
            onClick={() => update({ dayOffset: s.dayOffset + 1 })}
            aria-label="Next day"
          >
            <i className="ti ti-chevron-right" />
          </button>
        ) : (
          <div style={{ width: 30 }} />
        )}
        {s.timeWindowMenuOpen && (
          <div className="tw-menu">
            {(["today", "7d", "30d"] as TimeWindow[]).map((tw) => (
              <button
                key={tw}
                className={`tw-menu-item ${s.timeWindow === tw ? "selected" : ""}`}
                onClick={() => update({ timeWindow: tw, timeWindowMenuOpen: false, dayOffset: 0 })}
              >
                {tw === "today" ? "Today" : tw === "7d" ? "Last 7 days" : "Last 30 days"}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderViewShortcuts = (): ReactNode => (
    <div className="view-shortcut-row">
      <button className="view-shortcut" onClick={() => setScreen("pipeline")}>
        <div className="view-shortcut-icon">
          <i className="ti ti-list-details" />
        </div>
        <div className="view-shortcut-text">
          <div className="view-shortcut-title">Pipeline</div>
          <div className="view-shortcut-sub">12 active leads</div>
          <div className="view-shortcut-pip">
            <span className="pip-dot pip-l0" title="L0" />
            <span className="pip-dot pip-l1" title="L1" />
            <span className="pip-dot pip-l2" title="L2" />
            <span className="pip-dot pip-l2" title="L2" />
            <span className="pip-dot pip-l3" title="L3" />
            <span className="pip-dot pip-l3" title="L3" />
            <span className="pip-dot pip-l3" title="L3" />
            <span className="pip-dot pip-l3" title="L3" />
          </div>
        </div>
        <i className="ti ti-chevron-right" style={{ color: "var(--text-tertiary)" }} />
      </button>
      <button className="view-shortcut" onClick={() => setScreen("calendar")}>
        <div className="view-shortcut-icon">
          <i className="ti ti-calendar" />
        </div>
        <div className="view-shortcut-text">
          <div className="view-shortcut-title">Schedule</div>
          <div className="view-shortcut-sub">5 today · 7 tomorrow</div>
          <div className="view-shortcut-sub" style={{ marginTop: 4, fontSize: 10 }}>
            Next: 2:30 PM · Mira P.
          </div>
        </div>
        <i className="ti ti-chevron-right" style={{ color: "var(--text-tertiary)" }} />
      </button>
    </div>
  );

  const renderTier0 = (): ReactNode => {
    const t0 = timeWindowData[s.timeWindow].tier0(s.dayOffset);
    return (
      <div className="tier0-strip">
        <button
          className={`tier0-card ${t0.l0.count > 0 ? "active-l0" : "idle"}`}
          onClick={() => setScreen("callbacks")}
        >
          <div className="tier0-label">Safety escalation — welfare follow-up</div>
          <div className="tier0-count">{t0.l0.count}</div>
          <div className="tier0-age">{t0.l0.age}</div>
        </button>
        <button
          className={`tier0-card ${t0.l1.count > 0 ? "active-l1" : "idle"}`}
          onClick={() => setScreen("emergencies")}
        >
          <div className="tier0-label">Emergency — dispatch decision</div>
          <div className="tier0-count">{t0.l1.count}</div>
          <div className="tier0-age">{t0.l1.age}</div>
        </button>
        <button
          className={`tier0-card ${t0.quote.count > 0 ? "active-quote" : "idle"}`}
          onClick={() => setScreen("quotes-queue")}
        >
          <div className="tier0-label">Quote awaiting your approval</div>
          <div className="tier0-count">{t0.quote.count}</div>
          <div className="tier0-age">{t0.quote.age}</div>
        </button>
      </div>
    );
  };

  const renderAccordion = (type: "conversion" | "revenue"): ReactNode => {
    if (type === "conversion") {
      const period = s.conversionPeriod;
      const variant = s.conversionVariant;
      const data = getSparkData(`conversion_${variant}`, period);
      const avg = Math.round(data.reduce((sum, v) => sum + v, 0) / data.length);
      const max = Math.max(...data);
      const min = Math.min(...data);
      const labelStart = period === "7d" ? "May 20" : "Apr 27";
      return (
        <div className="accordion-expand">
          <div className="accordion-tabs">
            {(["7d", "30d"] as AccordionPeriod[]).map((p) => (
              <button
                key={p}
                className={`accordion-tab ${period === p ? "active" : ""}`}
                onClick={() => update({ conversionPeriod: p })}
              >
                {p === "7d" ? "7 days" : "30 days"}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
            Conversion to {variant === "quote" ? "quote" : "booking"}
          </div>
          <div className="mini-chart">
            <Sparkline
              data={data}
              strokeColor="#3B6D11"
              fillColor="#C0DD97"
              opts={{ strokeWidth: 2, dotR: 3 }}
            />
          </div>
          <div className="chart-stats">
            <span>{labelStart}</span>
            <span>
              Avg {avg}% · High {max}% · Low {min}%
            </span>
            <span>May 26</span>
          </div>
        </div>
      );
    }
    const period = s.revenuePeriod;
    const variant = s.revenueVariant;
    const data = getSparkData(`revenue_${variant}`, period);
    const total = data.reduce((sum, v) => sum + v, 0);
    const avg = Math.round(total / data.length);
    const labelStart = period === "7d" ? "May 20" : "Apr 27";
    return (
      <div className="accordion-expand">
        <div className="accordion-tabs">
          {(["7d", "30d"] as AccordionPeriod[]).map((p) => (
            <button
              key={p}
              className={`accordion-tab ${period === p ? "active" : ""}`}
              onClick={() => update({ revenuePeriod: p })}
            >
              {p === "7d" ? "7 days" : "30 days"}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
          Revenue {variant}
        </div>
        <div className="mini-chart">
          <Sparkline
            data={data}
            strokeColor="#21295C"
            fillColor="#B5D4F4"
            opts={{ strokeWidth: 2, dotR: 3 }}
          />
        </div>
        <div className="chart-stats">
          <span>{labelStart}</span>
          <span>
            Total {fmt$(total)} · Avg {fmt$(avg)}/day
          </span>
          <span>May 26</span>
        </div>
      </div>
    );
  };

  const renderTier1 = (): ReactNode => {
    const m = timeWindowData[s.timeWindow].metrics(s.dayOffset);
    const periodKey: AccordionPeriod = s.timeWindow === "30d" ? "30d" : "7d";

    const convVariant = s.conversionVariant;
    const convValue = m.conversion[convVariant].value;
    const convSub = m.conversion[convVariant].sub;
    const convSpark = getSparkData(`conversion_${convVariant}`, periodKey);

    const revVariant = s.revenueVariant;
    const revValue = m.revenue[revVariant].value;
    const revSub = m.revenue[revVariant].sub;
    const revSpark = getSparkData(`revenue_${revVariant}`, periodKey);

    const sectionLabel =
      s.timeWindow === "today"
        ? s.dayOffset === 0
          ? "Today's snapshot"
          : "Snapshot"
        : `${s.timeWindow === "7d" ? "Last 7 days" : "Last 30 days"} snapshot`;

    return (
      <>
        <div className="section-row">
          <div className="section-h">{sectionLabel}</div>
        </div>
        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-label">New conversations</div>
            <div className="metric-value">{m.newConv.value}</div>
            <div className="metric-sub">{m.newConv.sub}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Bookings</div>
            <div className="metric-value">{m.bookings.value}</div>
            <div className="metric-sub">{m.bookings.sub}</div>
          </div>

          <div
            className="metric-card tappable green-highlight"
            onClick={() => update({ conversionAccordion: !s.conversionAccordion })}
          >
            <div className="metric-label">
              <span>Conversion · to {convVariant === "quote" ? "quote" : "booking"}</span>
              <i
                className={`ti ti-chevron-${s.conversionAccordion ? "up" : "down"}`}
                style={{ fontSize: 12 }}
              />
            </div>
            <div className="metric-value">{convValue}</div>
            <div className="metric-sub">{convSub}</div>
            {convSpark.length > 0 && (
              <div className="metric-sparkline">
                <Sparkline data={convSpark} strokeColor="#27500A" fillColor="#C0DD97" />
              </div>
            )}
            <div className="metric-variant-toggle" onClick={(e) => e.stopPropagation()}>
              {(["quote", "booking"] as ConversionVariant[]).map((v) => (
                <button
                  key={v}
                  className={`metric-variant-btn ${convVariant === v ? "active" : ""}`}
                  onClick={() => update({ conversionVariant: v })}
                >
                  {v === "quote" ? "To quote" : "To booking"}
                </button>
              ))}
            </div>
          </div>

          <div
            className="metric-card tappable"
            onClick={() => update({ revenueAccordion: !s.revenueAccordion })}
          >
            <div className="metric-label">
              <span>Revenue · {revVariant}</span>
              <i
                className={`ti ti-chevron-${s.revenueAccordion ? "up" : "down"}`}
                style={{ fontSize: 12 }}
              />
            </div>
            <div className="metric-value">{revValue}</div>
            <div className="metric-sub">{revSub}</div>
            {revSpark.length > 0 && (
              <div className="metric-sparkline">
                <Sparkline data={revSpark} strokeColor="#21295C" fillColor="#B5D4F4" />
              </div>
            )}
            <div className="metric-variant-toggle" onClick={(e) => e.stopPropagation()}>
              {(["quoted", "booked", "invoiced"] as RevenueVariant[]).map((v) => (
                <button
                  key={v}
                  className={`metric-variant-btn ${revVariant === v ? "active" : ""}`}
                  onClick={() => update({ revenueVariant: v })}
                >
                  {v === "quoted" ? "Quoted" : v === "booked" ? "Booked" : "Invoiced"}
                </button>
              ))}
            </div>
          </div>

          {s.conversionAccordion && renderAccordion("conversion")}
          {s.revenueAccordion && renderAccordion("revenue")}
        </div>
      </>
    );
  };

  const renderNextUp = (): ReactNode => (
    <>
      <div className="section-row">
        <div className="section-h">Next up</div>
        <button className="section-action" onClick={() => setScreen("calendar")}>
          <i className="ti ti-calendar" />
          <span>Calendar</span>
        </button>
      </div>
      <div
        className="next-job-card"
        onClick={() => update({ todayJobsExpanded: !s.todayJobsExpanded })}
      >
        <div className="next-job-time">{s.todayJobsExpanded ? "Today" : "2:30 PM"}</div>
        <div className="next-job-info">
          {s.todayJobsExpanded ? (
            <>
              <div className="next-job-name">5 bookings · 3 done, 2 ahead</div>
              <div className="next-job-detail">Tap to collapse</div>
            </>
          ) : (
            <>
              <div className="next-job-name">Mira Patel — water heater leaking</div>
              <div className="next-job-detail">847 Davenport Rd · L2 · Booked yesterday</div>
            </>
          )}
        </div>
        <i className={`ti ti-chevron-${s.todayJobsExpanded ? "up" : "down"} next-job-action`} />
      </div>
      {s.todayJobsExpanded ? (
        <div className="day-bookings">
          <DayBookingRow time="9:00 AM" name="Andre Khan — kitchen sink leak" status="Done" done />
          <DayBookingRow
            time="11:00 AM"
            name="Eli Nakamura — toilet running"
            status="Done"
            done
          />
          <DayBookingRow
            time="1:00 PM"
            name="Sofia Bertelli — faucet replacement"
            status="Done"
            done
          />
          <DayBookingRow
            time="2:30 PM"
            name="Mira Patel — water heater leaking"
            status="L2"
            statusClass="urg-pill-l2"
            rowStyle={{ background: "var(--l2-fill)", border: "1px solid var(--l2-stroke)" }}
          />
          <DayBookingRow time="4:00 PM" name="Daniel Cho — dishwasher install" status="L3" />
        </div>
      ) : (
        <div className="next-job-card">
          <div className="next-job-time">4:00 PM</div>
          <div className="next-job-info">
            <div className="next-job-name">Daniel Cho — dishwasher install</div>
            <div className="next-job-detail">142 Roncesvalles Ave · L3 · Quoted $480</div>
          </div>
          <i className="ti ti-chevron-right next-job-action" />
        </div>
      )}
    </>
  );

  const renderTodayContent = (): ReactNode => (
    <>
      {renderTimeWindow()}
      {renderViewShortcuts()}
      {renderTier0()}
      {renderTier1()}
      {renderNextUp()}
    </>
  );

  // ====================================================================
  // Notes + checklist (shared)
  // ====================================================================

  const renderNotesAndChecklist = (
    personId: string,
    items: { key: string; label: string }[],
  ): ReactNode => {
    const notes = s.notesData[personId] ?? { text: "", checklist: {} };
    const time = "2:18 PM";
    const toggleChecklistItem = (itemKey: string) => {
      setS((prev) => {
        const existing = prev.notesData[personId] ?? { text: "", checklist: {} };
        return {
          ...prev,
          notesData: {
            ...prev.notesData,
            [personId]: {
              ...existing,
              checklist: { ...existing.checklist, [itemKey]: !existing.checklist[itemKey] },
            },
          },
        };
      });
    };
    const updateNote = (value: string) => {
      setS((prev) => {
        const existing = prev.notesData[personId] ?? { text: "", checklist: {} };
        return {
          ...prev,
          notesData: { ...prev.notesData, [personId]: { ...existing, text: value } },
        };
      });
    };
    return (
      <div className="notes-section">
        <div className="notes-label">Quick actions</div>
        <div className="checklist">
          {items.map((item) => (
            <button
              key={item.key}
              className={`checklist-item ${notes.checklist[item.key] ? "checked" : ""}`}
              onClick={() => toggleChecklistItem(item.key)}
            >
              <span className="check-box" />
              <span className="checklist-label">{item.label}</span>
              {notes.checklist[item.key] && (
                <span className="checklist-timestamp">{time}</span>
              )}
            </button>
          ))}
        </div>

        <div className="notes-label" style={{ marginTop: 14 }}>
          Notes
        </div>
        <textarea
          className="notes-textarea"
          placeholder="Add a note — outcome of the call, customer concern, follow-up needed, anything to remember…"
          value={notes.text}
          onChange={(e) => updateNote(e.target.value)}
        />
      </div>
    );
  };

  // ====================================================================
  // CALLBACKS, EMERGENCIES, QUOTES QUEUE
  // ====================================================================

  const renderCallbacksContent = (): ReactNode => (
    <>
      <div className="filter-context l0">
        <i className="ti ti-shield-exclamation" />
        <div>Customers directed to outside help. Call back to confirm safety.</div>
      </div>

      <div className="drill-row l0">
        <div className="drill-top">
          <div className="avatar l0">MH</div>
          <div
            className="drill-name"
            onClick={() => setScreen("conv-detail")}
            style={{ cursor: "pointer" }}
          >
            Marta Hennings
          </div>
          <div className="drill-time">4 min ago</div>
        </div>
        <div className="drill-grid">
          <DrillField label="Phone" value="+1 (416) 555-0142" />
          <DrillField label="Email" value="m.hennings@email.com" />
          <DrillField label="Urgency" value="L0 OOS — safety" />
          <DrillField label="Directed to" value="Enbridge — 1-866-763-5427" />
          <DrillField
            label="Reason"
            value="Strong gas smell in basement. Customer confirmed evacuation before call ended."
          />
        </div>

        {renderNotesAndChecklist("marta", [
          { key: "called", label: "Called customer" },
          { key: "voicemail", label: "Left voicemail" },
          { key: "enbridge_confirmed", label: "Confirmed Enbridge cleared the home" },
          { key: "rescheduled", label: "Discussed follow-up service" },
          { key: "closed", label: "Welfare confirmed · close loop" },
        ])}

        <div className="drill-actions">
          <button
            className="drill-btn primary"
            onClick={() => showToast("Dialing Marta Hennings…")}
          >
            <i className="ti ti-phone" />
            Call now
          </button>
          <button className="drill-btn" onClick={() => setScreen("conv-detail")}>
            <i className="ti ti-eye" />
            Transcript
          </button>
          <button
            className="drill-btn"
            onClick={() => showToast("Marked as called. Welfare follow-up complete.")}
          >
            <i className="ti ti-check" />
            Mark done
          </button>
        </div>
      </div>
    </>
  );

  const renderEmergenciesContent = (): ReactNode => (
    <>
      <div className="filter-context l1">
        <i className="ti ti-flame" />
        <div>Active emergencies awaiting your call.</div>
      </div>

      <div className="drill-row l1">
        <div className="drill-top">
          <div className="avatar l1">JO</div>
          <div className="drill-name">James Okafor</div>
          <div className="drill-time">12 min ago</div>
        </div>
        <div className="drill-grid">
          <DrillField label="Phone" value="+1 (647) 555-0188" />
          <DrillField label="Address" value="312 Wallace Ave" />
          <DrillField label="Urgency" value="L1 emergency" />
          <DrillField label="First step" value="Main shutoff successful" />
          <DrillField
            label="Reason"
            value="Burst pipe in basement. Water contained after main shutoff. Drywall and flooring damage visible."
          />
        </div>

        {renderNotesAndChecklist("james", [
          { key: "called", label: "Called customer" },
          { key: "voicemail", label: "Left voicemail" },
          { key: "sub_assigned", label: "Assigned to sub / tech" },
          { key: "eta_given", label: "ETA confirmed with customer" },
          { key: "closed", label: "Dispatch complete · close loop" },
        ])}

        <div className="drill-actions">
          <button
            className="drill-btn primary"
            onClick={() => showToast("Dispatching to 312 Wallace Ave")}
          >
            <i className="ti ti-truck" />
            Dispatch myself
          </button>
          <button className="drill-btn" onClick={() => showToast("Looking for a sub…")}>
            <i className="ti ti-users" />
            Find a sub
          </button>
          <button className="drill-btn" onClick={() => showToast("Calling James Okafor…")}>
            <i className="ti ti-phone" />
            Call
          </button>
        </div>
      </div>
    </>
  );

  const renderQuotesQueueContent = (): ReactNode => (
    <>
      <div className="filter-context quote">
        <i className="ti ti-file-dollar" />
        <div>Approve to send to customer. Revise to edit before sending.</div>
      </div>

      <div className="drill-row quote">
        <div className="drill-top">
          <div className="avatar quote">PR</div>
          <div
            className="drill-name"
            onClick={() => setScreen("quote-review")}
            style={{ cursor: "pointer" }}
          >
            Priya Ramaswamy
          </div>
          <div className="drill-time">38 min ago</div>
        </div>
        <div className="drill-grid">
          <DrillField label="Scope" value="Toilet replacement, master bath" />
          <DrillField label="Total" value="$565.55 incl. HST" />
          <DrillField label="Urgency" value="L3 scheduled" />
          <DrillField label="Phone" value="+1 (905) 555-0273" />
        </div>
        <div className="drill-actions">
          <button className="drill-btn primary" onClick={() => setScreen("quote-review")}>
            <i className="ti ti-eye" />
            Review quote
          </button>
        </div>
      </div>

      <div className="drill-row quote">
        <div className="drill-top">
          <div className="avatar quote">BW</div>
          <div className="drill-name">Brendan Wojcik</div>
          <div className="drill-time">1 hr ago</div>
        </div>
        <div className="drill-grid">
          <DrillField label="Scope" value="Kitchen sink slow drain" />
          <DrillField label="Total" value="$209.05 incl. HST" />
          <DrillField label="Urgency" value="L3 scheduled" />
          <DrillField label="Phone" value="+1 (416) 555-0341" />
        </div>
        <div className="drill-actions">
          <button
            className="drill-btn primary"
            onClick={() => showToast("Loading Brendan's quote…")}
          >
            <i className="ti ti-eye" />
            Review quote
          </button>
        </div>
      </div>
    </>
  );

  // ====================================================================
  // PIPELINE
  // ====================================================================

  const renderPipelineContent = (): ReactNode => (
    <>
      <div className="group-header">
        <i className="ti ti-alert-triangle" style={{ color: "var(--l0-stroke)" }} />
        Needs you · 4
      </div>

      <div className="conv-row urg-l0" onClick={() => setScreen("conv-detail")}>
        <div className="conv-top">
          <div className="conv-name">Marta Hennings</div>
          <div className="conv-time">4 min ago</div>
        </div>
        <div className="conv-summary">
          Strong gas smell — agent directed to Enbridge. Welfare follow-up needed.
        </div>
        <div className="conv-bottom">
          <span className="urg-label">
            <i className="ti ti-shield-exclamation" style={{ fontSize: 10 }} /> L0 OOS
          </span>
          <span className="status-pill needs-you">Call back</span>
        </div>
      </div>

      <div className="conv-row urg-l1" onClick={() => setScreen("emergencies")}>
        <div className="conv-top">
          <div className="conv-name">James Okafor</div>
          <div className="conv-time">12 min ago</div>
        </div>
        <div className="conv-summary">
          Burst pipe, water shutoff successful. Awaiting dispatch decision.
        </div>
        <div className="conv-bottom">
          <span className="urg-label">L1 emergency</span>
          <span className="status-pill needs-you">Dispatch?</span>
        </div>
      </div>

      <div className="conv-row urg-l3" onClick={() => setScreen("quote-review")}>
        <div className="conv-top">
          <div className="conv-name">Priya Ramaswamy</div>
          <div className="conv-time">38 min ago</div>
        </div>
        <div className="conv-summary">Toilet replacement, master bath. Quote drafted: $565.55.</div>
        <div className="conv-bottom">
          <span className="urg-label">L3 scheduled</span>
          <span className="status-pill needs-you">Approve quote</span>
        </div>
      </div>

      <div className="conv-row urg-l3">
        <div className="conv-top">
          <div className="conv-name">Brendan Wojcik</div>
          <div className="conv-time">1 hr ago</div>
        </div>
        <div className="conv-summary">Kitchen sink slow drain. Quote drafted: $209.05.</div>
        <div className="conv-bottom">
          <span className="urg-label">L3 scheduled</span>
          <span className="status-pill needs-you">Approve quote</span>
        </div>
      </div>

      <div className="group-header">
        <i className="ti ti-clock" />
        Customer-side · 3
      </div>

      <div className="conv-row urg-l2">
        <div className="conv-top">
          <div className="conv-name">Aisha Lin</div>
          <div className="conv-time">22 min ago</div>
        </div>
        <div className="conv-summary">
          Hot water tank not heating. Calendly link sent, awaiting booking.
        </div>
        <div className="conv-bottom">
          <span className="urg-label">L2 priority</span>
          <span className="status-pill customer-side">Awaiting booking</span>
        </div>
      </div>

      <div className="conv-row urg-l3">
        <div className="conv-top">
          <div className="conv-name">Tomás Reyes</div>
          <div className="conv-time">1 hr ago</div>
        </div>
        <div className="conv-summary">Faucet replacement. Quote sent: $340.</div>
        <div className="conv-bottom">
          <span className="urg-label">L3 scheduled</span>
          <span className="status-pill customer-side">Quote sent</span>
        </div>
      </div>

      <div className="conv-row urg-l3">
        <div className="conv-top">
          <div className="conv-name">Helen Mwangi</div>
          <div className="conv-time">2 hr ago</div>
        </div>
        <div className="conv-summary">Bathroom renovation rough-in. Site visit requested.</div>
        <div className="conv-bottom">
          <span className="urg-label">L3 scheduled</span>
          <span className="status-pill customer-side">Site visit pending</span>
        </div>
      </div>

      <div className="group-header">
        <i className="ti ti-calendar" />
        Booked · 5
      </div>

      <div className="conv-row urg-l2" onClick={() => setScreen("calendar")}>
        <div className="conv-top">
          <div className="conv-name">Mira Patel</div>
          <div className="conv-time">Today 2:30 PM</div>
        </div>
        <div className="conv-summary">Water heater leaking. $1,840 quoted.</div>
        <div className="conv-bottom">
          <span className="urg-label">L2 priority</span>
          <span className="status-pill booked">Next up</span>
        </div>
      </div>

      <button
        className={`closed-toggle ${s.closedExpanded ? "open" : ""}`}
        onClick={() => update({ closedExpanded: !s.closedExpanded })}
      >
        <div className="closed-toggle-icon">
          <i className="ti ti-archive" />
        </div>
        <div className="closed-toggle-text">
          <div className="closed-toggle-title">Closed · 12</div>
          <div className="closed-toggle-sub">
            Tap to {s.closedExpanded ? "collapse" : "see archived conversations"}
          </div>
        </div>
        <i className="ti ti-chevron-right chev" />
      </button>

      {s.closedExpanded && (
        <>
          <ClosedRow name="Sarah Chen" time="Yesterday 4:18 PM" summary="Toilet flapper replacement. Completed. Invoiced $145." level="l3" />
          <ClosedRow name="Marcus Levitt" time="Yesterday 1:42 PM" summary="Outdoor hose bib replacement. Completed. Invoiced $290." level="l3" />
          <ClosedRow name="Indira Bose" time="2 days ago" summary="Sink leak under-counter. Completed. Invoiced $220." level="l2" />
          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "var(--text-secondary)",
              padding: 8,
            }}
          >
            + 9 more closed conversations
          </div>
        </>
      )}
    </>
  );

  // ====================================================================
  // CONVERSATION DETAIL
  // ====================================================================

  const renderConvDetailContent = (): ReactNode => (
    <div className="detail-card">
      <div className="detail-header">
        <div className="avatar l0">MH</div>
        <div style={{ flex: 1 }}>
          <div className="detail-name">Marta Hennings</div>
          <div className="detail-meta">+1 (416) 555-0142 · m.hennings@email.com</div>
          <div className="detail-meta">Started 4 min ago</div>
        </div>
        <span
          className="urg-label"
          style={{ background: "var(--l0-stroke)", color: "var(--l0-fill)" }}
        >
          <i className="ti ti-shield-exclamation" style={{ fontSize: 10 }} /> L0
        </span>
      </div>

      <div className="escalation-banner">
        <i className="ti ti-alert-triangle" />
        <div className="escalation-text">
          <strong>Welfare follow-up needed.</strong>
          <br />
          Customer directed to Enbridge Gas Emergency at 1-866-763-5427. Confirmed she was outside
          before ending. No booking sent. Call back within the hour.
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
        Transcript
      </div>
      <div className="transcript">
        <div className="turn turn-cust">
          &quot;I just got home and there&apos;s a really strong smell in the basement, I think
          it&apos;s gas, what do I do?&quot;
        </div>
        <div className="turn turn-agent">
          That can be dangerous — please leave the house right now. Don&apos;t touch any light
          switches, phones, or appliances on your way out. Are you able to get outside?
        </div>
        <div className="turn turn-cust">&quot;Okay, I&apos;m heading out.&quot;</div>
        <div className="turn turn-agent">
          Good. Once you&apos;re outside, call Enbridge Gas Emergency at 1-866-763-5427. If anyone
          is feeling dizzy or unwell, call 911 first.
        </div>
        <div className="turn turn-cust">&quot;I&apos;m outside now. Calling Enbridge.&quot;</div>
        <div className="turn turn-agent">
          You did the right thing reaching out. I&apos;m flagging this for Jill — she&apos;ll
          personally call you back within the hour to make sure you&apos;re okay and help with next
          steps.
        </div>
      </div>

      <div className="drill-actions">
        <button className="drill-btn primary" onClick={() => showToast("Calling Marta Hennings…")}>
          <i className="ti ti-phone" />
          Call now
        </button>
        <button className="drill-btn" onClick={() => setScreen("plumber-sms")}>
          <i className="ti ti-message" />
          Draft SMS
        </button>
        <button
          className="drill-btn"
          onClick={() => showToast("Marked complete. Welfare confirmed.")}
        >
          <i className="ti ti-check" />
          Mark done
        </button>
      </div>
    </div>
  );

  // ====================================================================
  // CALENDAR
  // ====================================================================

  const renderCalDay = (): ReactNode => (
    <>
      <div className="cal-month-header">
        <div className="cal-month-label">Tuesday · May 26 (today)</div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            className="header-action"
            style={{ width: 28, height: 28, fontSize: 14 }}
          >
            <i className="ti ti-chevron-left" />
          </button>
          <button
            className="header-action"
            style={{ width: 28, height: 28, fontSize: 14 }}
          >
            <i className="ti ti-chevron-right" />
          </button>
        </div>
      </div>
      <div className="day-bookings">
        <DayBookingRow time="9:00 AM" name="Andre Khan — kitchen sink leak" status="Done" done />
        <DayBookingRow time="11:00 AM" name="Eli Nakamura — toilet running" status="Done" done />
        <DayBookingRow
          time="1:00 PM"
          name="Sofia Bertelli — faucet replacement"
          status="Done"
          done
        />
        <DayBookingRow
          time="2:30 PM"
          name="Mira Patel — water heater leaking"
          status="L2"
          statusClass="urg-pill-l2"
          rowStyle={{ background: "var(--l2-fill)", border: "1px solid var(--l2-stroke)" }}
        />
        <DayBookingRow time="4:00 PM" name="Daniel Cho — dishwasher install" status="L3" />
      </div>
    </>
  );

  const renderCalWeek = (): ReactNode => {
    const weekdays = [
      { name: "Sun · May 24", count: 0 },
      { name: "Mon · May 25", count: 6 },
      { name: "Tue · May 26 (today)", count: 5, today: true },
      { name: "Wed · May 27", count: 7, l1: true },
      { name: "Thu · May 28", count: 4 },
      { name: "Fri · May 29", count: 3 },
      { name: "Sat · May 30", count: 0 },
    ];
    return (
      <>
        <div className="cal-month-header">
          <div className="cal-month-label">Week of May 24</div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="header-action"
              style={{ width: 28, height: 28, fontSize: 14 }}
            >
              <i className="ti ti-chevron-left" />
            </button>
            <button
              className="header-action"
              style={{ width: 28, height: 28, fontSize: 14 }}
            >
              <i className="ti ti-chevron-right" />
            </button>
          </div>
        </div>
        {weekdays.map((d) => (
          <div className="week-day-card" key={d.name}>
            <div
              className="week-day-header"
              style={d.today ? { borderLeft: "3px solid var(--navy)" } : undefined}
            >
              <span>{d.name}</span>
              <span className="week-day-count">
                {d.count} {d.count === 1 ? "booking" : "bookings"}
                {d.l1 ? " · L1 alert" : ""}
              </span>
            </div>
            {d.count === 0 ? (
              <div className="week-day-empty">No bookings</div>
            ) : (
              <div style={{ padding: 8 }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", padding: 4 }}>
                  Tap to see all {d.count} bookings
                </div>
              </div>
            )}
          </div>
        ))}
      </>
    );
  };

  const renderDayBookingsExpansion = (day: number): ReactNode => {
    if (day === 26) {
      return (
        <div className="day-bookings" style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--text-secondary)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            May 26 · 5 bookings
          </div>
          <DayBookingRow time="9:00 AM" name="Andre Khan" status="Done" done />
          <DayBookingRow time="11:00 AM" name="Eli Nakamura" status="Done" done />
          <DayBookingRow time="1:00 PM" name="Sofia Bertelli" status="Done" done />
          <DayBookingRow
            time="2:30 PM"
            name="Mira Patel"
            status="L2"
            statusClass="urg-pill-l2"
            rowStyle={{ background: "var(--l2-fill)", border: "1px solid var(--l2-stroke)" }}
          />
          <DayBookingRow time="4:00 PM" name="Daniel Cho" status="L3" />
        </div>
      );
    }
    return (
      <div className="day-bookings" style={{ marginTop: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--text-secondary)",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          May {day} · sample bookings
        </div>
        <DayBookingRow
          time="10:00 AM"
          name="Sample booking — drain unclog"
          status="L3"
        />
        <DayBookingRow
          time="2:00 PM"
          name="Sample booking — faucet repair"
          status="L3"
        />
      </div>
    );
  };

  const renderCalMonth = (): ReactNode => {
    const bookings: Record<number, { count: number; today?: boolean; hasL1?: boolean }> = {
      20: { count: 4 },
      21: { count: 3 },
      22: { count: 5 },
      23: { count: 0 },
      24: { count: 0 },
      25: { count: 6 },
      26: { count: 5, today: true, hasL1: true },
      27: { count: 7 },
      28: { count: 4 },
      29: { count: 3 },
      30: { count: 0 },
      31: { count: 0 },
    };
    const daysInMonth = 31;
    const firstDayOfWeek = 5;
    const cells: ReactNode[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(
        <div className="cal-day dim" key={`dim-${i}`}>
          <span className="cal-day-num">{30 - firstDayOfWeek + i + 1}</span>
        </div>,
      );
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const info = bookings[d];
      const classes = ["cal-day"];
      if (info?.today) classes.push("today");
      if (info && info.count > 0) {
        classes.push("has-bookings");
        if (info.hasL1) classes.push("l1");
      }
      cells.push(
        <button
          key={`d-${d}`}
          className={classes.join(" ")}
          onClick={() => update({ selectedCalDay: s.selectedCalDay === d ? null : d })}
        >
          <span className="cal-day-num">{d}</span>
          {info && info.count > 0 && <span className="cal-day-badge">{info.count}</span>}
        </button>,
      );
    }
    return (
      <>
        <div className="cal-month-header">
          <div className="cal-month-label">May 2026</div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="header-action"
              style={{ width: 28, height: 28, fontSize: 14 }}
            >
              <i className="ti ti-chevron-left" />
            </button>
            <button
              className="header-action"
              style={{ width: 28, height: 28, fontSize: 14 }}
            >
              <i className="ti ti-chevron-right" />
            </button>
          </div>
        </div>
        <div className="cal-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div className="cal-day-header" key={day}>
              {day}
            </div>
          ))}
          {cells}
        </div>
        {s.selectedCalDay !== null && renderDayBookingsExpansion(s.selectedCalDay)}
      </>
    );
  };

  const renderCalendarContent = (): ReactNode => (
    <>
      <div className="cal-toolbar">
        <div className="tab-group">
          {(["day", "week", "month"] as CalendarMode[]).map((m) => (
            <button
              key={m}
              className={`cal-tab ${s.calendarMode === m ? "active" : ""}`}
              onClick={() => update({ calendarMode: m, selectedCalDay: null })}
            >
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {s.calendarMode === "month" && renderCalMonth()}
      {s.calendarMode === "week" && renderCalWeek()}
      {s.calendarMode === "day" && renderCalDay()}
    </>
  );

  // ====================================================================
  // PLUMBER SMS
  // ====================================================================

  const renderPlumberSmsContent = (): ReactNode => (
    <div className="sms-wrapper">
      <div className="sms-thread-header">
        <div className="sms-thread-avatar">P</div>
        <div className="sms-thread-name">Pipeline</div>
        <div className="sms-thread-meta">SMS · today</div>
      </div>
      <div className="sms-thread">
        <div className="sms-timestamp">11:42 AM</div>
        <div className="sms-bubble incoming">
          🆕 New L3 conversation — Priya Ramaswamy. Toilet replacement, master bath. Agent has
          drafted a quote for your review.
          <div className="sms-link" onClick={() => setScreen("quote-review")}>
            <i className="ti ti-file-dollar" />
            Review quote · $565.55
          </div>
        </div>
        <div className="sms-timestamp">12:08 PM</div>
        <div className="sms-bubble incoming">
          🔴 L1 emergency — James Okafor. Burst pipe in basement, water shutoff successful. Awaiting
          your dispatch decision.
          <div className="sms-link" onClick={() => setScreen("emergencies")}>
            <i className="ti ti-flame" />
            Open emergency
          </div>
        </div>
        <div className="sms-timestamp">2:14 PM</div>
        <div
          className="sms-bubble incoming"
          style={{ background: "var(--l0-fill)", borderColor: "var(--l0-stroke)" }}
        >
          ⚠️ L0 SAFETY — Marta Hennings. Gas smell. Customer directed to Enbridge. Personal welfare
          follow-up needed within 1 hour.
          <div
            className="sms-link"
            onClick={() => setScreen("callbacks")}
            style={{ background: "var(--bg-surface)", color: "var(--l0-text)" }}
          >
            <i className="ti ti-shield-exclamation" />
            Open safety escalation
          </div>
        </div>
      </div>
    </div>
  );

  // ====================================================================
  // QUOTE REVIEW
  // ====================================================================

  const enterReviseFocus = (
    section: "problem" | "materials" | "labour",
    idx: number | null,
    field: "desc" | null,
  ) => {
    setS((prev) => ({
      ...prev,
      quoteMode: "edit",
      quoteEdits: JSON.parse(JSON.stringify(defaultQuoteData)) as QuoteData,
      focusedField: { section, idx, field } as FocusedField,
    }));
  };

  const enterRevise = () => {
    setS((prev) => ({
      ...prev,
      quoteMode: "edit",
      quoteEdits: JSON.parse(JSON.stringify(defaultQuoteData)) as QuoteData,
      focusedField: null,
    }));
  };

  const exitRevise = () => update({ quoteMode: "review", focusedField: null });

  const updateQuoteProblem = (value: string) => {
    setS((prev) =>
      prev.quoteEdits
        ? { ...prev, quoteEdits: { ...prev.quoteEdits, problem: value } }
        : prev,
    );
  };

  const updateQuoteLine = (
    section: "materials" | "labour",
    idx: number,
    field: keyof QuoteLineItem,
    value: string | number,
  ) => {
    setS((prev) => {
      if (!prev.quoteEdits) return prev;
      const next = { ...prev.quoteEdits, [section]: [...prev.quoteEdits[section]] };
      next[section][idx] = { ...next[section][idx], [field]: value } as QuoteLineItem;
      return { ...prev, quoteEdits: next };
    });
  };

  const addLineItem = (section: "materials" | "labour") => {
    setS((prev) => {
      if (!prev.quoteEdits) return prev;
      const next: QuoteData = {
        ...prev.quoteEdits,
        [section]: [
          ...prev.quoteEdits[section],
          {
            desc: "New " + (section === "materials" ? "material" : "labour line"),
            qty: 1,
            amount: 0,
          },
        ],
      };
      return { ...prev, quoteEdits: next };
    });
  };

  const removeLineItem = (section: "materials" | "labour", idx: number) => {
    setS((prev) => {
      if (!prev.quoteEdits) return prev;
      const next: QuoteData = {
        ...prev.quoteEdits,
        [section]: prev.quoteEdits[section].filter((_, i) => i !== idx),
      };
      return { ...prev, quoteEdits: next };
    });
  };

  const approveQuote = () => {
    showToast("Quote approved. Sending to Priya by email + SMS.");
    setTimeout(() => setScreen("customer-sms"), 800);
  };
  const saveAndApprove = () => {
    showToast("Revised quote saved and sent to Priya.");
    setTimeout(() => setScreen("customer-sms"), 800);
  };
  const confirmReject = () => {
    update({ showRejectModal: false });
    showToast("Quote rejected. Flagged for manual follow-up.");
    setTimeout(() => setScreen("quotes-queue"), 800);
  };

  const renderQuoteDoc = (data: QuoteData, totals: ReturnType<typeof calcTotals>): ReactNode => (
    <>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          margin: "4px 4px 10px",
          lineHeight: 1.5,
        }}
      >
        <i className="ti ti-info-circle" style={{ verticalAlign: -2 }} /> This is exactly what the
        customer will see. Tap any line item to revise.
      </div>

      <div className="quote-doc">
        <div className="quote-letterhead">
          <div className="quote-company">Jill&apos;s Plumbing</div>
          <div className="quote-tagline">Licensed P3 · Serving the GTA · jillsplumbing.ca</div>
        </div>

        <div className="quote-doc-title">Quote</div>

        <div className="quote-meta">
          <div className="quote-meta-block">
            <div className="quote-meta-label">Quote no.</div>
            <div className="quote-meta-value">{data.quoteNumber}</div>
          </div>
          <div className="quote-meta-block">
            <div className="quote-meta-label">Date issued</div>
            <div className="quote-meta-value">{data.date}</div>
          </div>
          <div className="quote-meta-block">
            <div className="quote-meta-label">Customer</div>
            <div className="quote-meta-value">
              {data.customer.name}
              <br />
              {data.customer.phone}
              <br />
              {data.customer.email}
            </div>
          </div>
          <div className="quote-meta-block">
            <div className="quote-meta-label">Service address</div>
            <div className="quote-meta-value">{data.customer.address}</div>
          </div>
        </div>

        <div className="quote-section">
          <div className="quote-section-h">Problem &amp; scope</div>
          <div
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              cursor: "pointer",
              padding: 4,
              borderRadius: "var(--radius-sm)",
              transition: "background 0.15s",
            }}
            onClick={() => enterReviseFocus("problem", null, null)}
          >
            {data.problem}
          </div>
        </div>

        <div className="quote-section">
          <div className="quote-section-h">Materials</div>
          <table className="quote-table">
            <thead>
              <tr>
                <th className="desc">Description</th>
                <th className="center">Qty</th>
                <th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.materials.map((m, i) => (
                <tr
                  key={i}
                  className="tappable-field"
                  onClick={() => enterReviseFocus("materials", i, "desc")}
                >
                  <td className="desc">{m.desc}</td>
                  <td className="qty">{m.qty}</td>
                  <td className="amt">{fmt$(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="quote-section">
          <div className="quote-section-h">Labour</div>
          <table className="quote-table">
            <thead>
              <tr>
                <th className="desc">Description</th>
                <th className="center">Qty</th>
                <th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.labour.map((l, i) => (
                <tr
                  key={i}
                  className="tappable-field"
                  onClick={() => enterReviseFocus("labour", i, "desc")}
                >
                  <td className="desc">{l.desc}</td>
                  <td className="qty">{l.qty}</td>
                  <td className="amt">{fmt$(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="quote-totals">
          <div className="quote-total-row">
            <span>Materials subtotal</span>
            <span>{fmt$(totals.materialsSubtotal)}</span>
          </div>
          <div className="quote-total-row">
            <span>Labour subtotal</span>
            <span>{fmt$(totals.labourSubtotal)}</span>
          </div>
          <div className="quote-total-row">
            <span style={{ fontWeight: 500 }}>Subtotal before tax</span>
            <span style={{ fontWeight: 500 }}>{fmt$(totals.subtotal)}</span>
          </div>
          <div className="quote-total-row">
            <span>HST (13%)</span>
            <span>{fmt$(totals.tax)}</span>
          </div>
          <div className="quote-total-row grand">
            <span>Total</span>
            <span>{fmt$(totals.total)}</span>
          </div>
        </div>

        <div className="quote-notes">
          <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            Notes &amp; terms.
          </strong>{" "}
          Quote valid until {data.validUntil}. Pricing assumes flange in serviceable condition; if
          flange replacement is required, additional materials and labour will be quoted on site.
          Work to be completed in a single visit, approximately 2.5 hours. 90-day workmanship
          warranty on labour; manufacturer warranties apply to materials. Customer-supplied fixture
          excluded from warranty.
        </div>
      </div>
    </>
  );

  const renderQuoteEdit = (data: QuoteData, totals: ReturnType<typeof calcTotals>): ReactNode => (
    <>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          margin: "4px 4px 10px",
          lineHeight: 1.5,
        }}
      >
        <i className="ti ti-edit" style={{ verticalAlign: -2 }} /> Edit line items below. Totals
        recalculate automatically. The highlighted field was the one you tapped.
      </div>

      <div className="quote-doc">
        <div className="quote-letterhead">
          <div className="quote-company">Jill&apos;s Plumbing</div>
          <div className="quote-tagline">
            {data.customer.name} · {data.quoteNumber} · {data.date}
          </div>
        </div>

        <div className="quote-section">
          <div className="quote-section-h">Problem &amp; scope</div>
          <textarea
            id="edit-problem"
            className={`edit-input ${s.focusedField?.section === "problem" ? "focused-highlight" : ""}`}
            style={{ minHeight: 70, fontSize: 11, lineHeight: 1.5 }}
            value={data.problem}
            onChange={(e) => updateQuoteProblem(e.target.value)}
          />
        </div>

        <div className="quote-section">
          <div className="quote-section-h">Materials</div>
          {data.materials.map((m, i) => (
            <div className="edit-line-item" key={i}>
              <input
                id={`edit-materials-${i}-desc`}
                className={`edit-input ${
                  s.focusedField?.section === "materials" &&
                  s.focusedField?.idx === i &&
                  s.focusedField?.field === "desc"
                    ? "focused-highlight"
                    : ""
                }`}
                value={m.desc}
                onChange={(e) => updateQuoteLine("materials", i, "desc", e.target.value)}
              />
              <input
                className="edit-input"
                type="number"
                min={0}
                step={1}
                value={m.qty}
                onChange={(e) =>
                  updateQuoteLine("materials", i, "qty", parseFloat(e.target.value) || 0)
                }
              />
              <input
                className="edit-input amt"
                type="number"
                min={0}
                step={0.01}
                value={m.amount}
                onChange={(e) =>
                  updateQuoteLine("materials", i, "amount", parseFloat(e.target.value) || 0)
                }
              />
              <button
                className="edit-line-delete"
                onClick={() => removeLineItem("materials", i)}
                aria-label="Remove"
              >
                <i className="ti ti-trash" />
              </button>
            </div>
          ))}
          <button className="edit-add-row" onClick={() => addLineItem("materials")}>
            + Add material
          </button>
        </div>

        <div className="quote-section">
          <div className="quote-section-h">Labour</div>
          {data.labour.map((l, i) => (
            <div className="edit-line-item" key={i}>
              <input
                id={`edit-labour-${i}-desc`}
                className={`edit-input ${
                  s.focusedField?.section === "labour" &&
                  s.focusedField?.idx === i &&
                  s.focusedField?.field === "desc"
                    ? "focused-highlight"
                    : ""
                }`}
                value={l.desc}
                onChange={(e) => updateQuoteLine("labour", i, "desc", e.target.value)}
              />
              <input
                className="edit-input"
                type="number"
                min={0}
                step={1}
                value={l.qty}
                onChange={(e) =>
                  updateQuoteLine("labour", i, "qty", parseFloat(e.target.value) || 0)
                }
              />
              <input
                className="edit-input amt"
                type="number"
                min={0}
                step={0.01}
                value={l.amount}
                onChange={(e) =>
                  updateQuoteLine("labour", i, "amount", parseFloat(e.target.value) || 0)
                }
              />
              <button
                className="edit-line-delete"
                onClick={() => removeLineItem("labour", i)}
                aria-label="Remove"
              >
                <i className="ti ti-trash" />
              </button>
            </div>
          ))}
          <button className="edit-add-row" onClick={() => addLineItem("labour")}>
            + Add labour line
          </button>
        </div>

        <div className="quote-totals">
          <div className="quote-total-row">
            <span>Materials subtotal</span>
            <span>{fmt$(totals.materialsSubtotal)}</span>
          </div>
          <div className="quote-total-row">
            <span>Labour subtotal</span>
            <span>{fmt$(totals.labourSubtotal)}</span>
          </div>
          <div className="quote-total-row">
            <span style={{ fontWeight: 500 }}>Subtotal before tax</span>
            <span style={{ fontWeight: 500 }}>{fmt$(totals.subtotal)}</span>
          </div>
          <div className="quote-total-row">
            <span>HST (13%)</span>
            <span>{fmt$(totals.tax)}</span>
          </div>
          <div className="quote-total-row grand">
            <span>Total</span>
            <span>{fmt$(totals.total)}</span>
          </div>
        </div>
      </div>
    </>
  );

  const renderQuoteReviewContent = (): ReactNode => {
    const data = s.quoteEdits ?? defaultQuoteData;
    const totals = calcTotals(data);
    return (
      <>
        {s.quoteMode === "review" ? renderQuoteDoc(data, totals) : renderQuoteEdit(data, totals)}
        {s.quoteMode === "review" ? (
          <div className="quote-action-bar">
            <button className="quote-btn approve" onClick={approveQuote}>
              <i className="ti ti-check" />
              Approve &amp; send
            </button>
            <button className="quote-btn revise" onClick={enterRevise}>
              <i className="ti ti-edit" />
              Revise
            </button>
            <button
              className="quote-btn reject"
              onClick={() => update({ showRejectModal: true })}
            >
              <i className="ti ti-x" />
              Reject
            </button>
          </div>
        ) : (
          <div className="quote-action-bar" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <button className="quote-btn approve" onClick={saveAndApprove}>
              <i className="ti ti-check" />
              Save &amp; send
            </button>
            <button className="quote-btn revise" onClick={exitRevise}>
              <i className="ti ti-eye" />
              Back to review
            </button>
          </div>
        )}
        {s.showRejectModal && (
          <div className="modal-overlay" onClick={() => update({ showRejectModal: false })}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title">Reject this quote?</div>
              <div className="modal-desc">
                The customer won&apos;t receive this quote. Pipeline will flag the conversation for
                manual follow-up by you. Why are you rejecting?
              </div>
              <textarea
                className="modal-textarea"
                placeholder="e.g., need site visit before quoting, customer needs to be called directly, scope unclear…"
              />
              <div className="modal-actions">
                <button
                  className="modal-btn secondary"
                  onClick={() => update({ showRejectModal: false })}
                >
                  Cancel
                </button>
                <button className="modal-btn primary" onClick={confirmReject}>
                  Reject &amp; flag
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  // ====================================================================
  // CUSTOMER SMS
  // ====================================================================

  const renderCustomerSmsContent = (): ReactNode => (
    <>
      <div
        style={{
          background: "var(--bg-secondary)",
          borderRadius: "var(--radius-md)",
          padding: "10px 12px",
          marginBottom: 12,
          fontSize: 11,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        <i className="ti ti-info-circle" style={{ verticalAlign: -2 }} /> This is what Priya sees on
        her phone after Jill approves the quote.
      </div>
      <div className="sms-wrapper">
        <div className="sms-thread-header">
          <div className="sms-thread-avatar" style={{ background: "var(--l2-stroke)" }}>
            JP
          </div>
          <div className="sms-thread-name">Jill&apos;s Plumbing</div>
          <div className="sms-thread-meta">+1 (416) 555-PIPE</div>
        </div>
        <div className="sms-thread">
          <div className="sms-timestamp">11:30 AM</div>
          <div className="sms-bubble incoming">
            Hi Priya — this is Pipeline, the assistant for Jill&apos;s Plumbing. Just to confirm,
            you&apos;re looking to replace the leaking toilet in your master bathroom. Is that
            right?
          </div>
          <div className="sms-bubble outgoing">
            Yes, that&apos;s right. I&apos;ve got the new toilet ready to install.
          </div>
          <div className="sms-bubble incoming">
            Great — thanks for confirming. Jill has reviewed the details and put together a quote
            for the work. Take a look whenever you&apos;re ready.
            <div className="sms-link">
              <i className="ti ti-file-dollar" />
              View your quote — $565.55
              <div
                style={{
                  fontSize: 9,
                  color: "var(--text-tertiary)",
                  fontFamily: "ui-monospace, monospace",
                  marginTop: 4,
                }}
              >
                jillsplumbing.ca/q/JP-2026-0341
              </div>
            </div>
          </div>
          <div className="sms-timestamp">2:30 PM</div>
          <div className="sms-bubble incoming">
            When you&apos;re ready to book, you can grab a time directly here:
            <div className="sms-link">
              <i className="ti ti-calendar" />
              Book your appointment
              <div
                style={{
                  fontSize: 9,
                  color: "var(--text-tertiary)",
                  fontFamily: "ui-monospace, monospace",
                  marginTop: 4,
                }}
              >
                calendly.com/jillsplumbing/visit
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // ====================================================================
  // HEADER + NAV + ROUTING
  // ====================================================================

  const HEADERS: Record<ScreenId, { title: string; subtitle: string; back?: ScreenId }> = {
    today: { title: "Today", subtitle: "Jill's Plumbing · Etobicoke, ON" },
    callbacks: {
      title: "Safety escalations",
      subtitle: "L0 · welfare follow-up needed",
      back: "today",
    },
    emergencies: { title: "Emergencies", subtitle: "L1 · dispatch decision", back: "today" },
    "quotes-queue": {
      title: "Quote approvals",
      subtitle: "Drafted by agent · awaiting your sign-off",
      back: "today",
    },
    pipeline: { title: "Pipeline", subtitle: "All active conversations" },
    "conv-detail": { title: "Conversation", subtitle: "Safety escalation", back: "callbacks" },
    calendar: { title: "Schedule", subtitle: "May 2026" },
    "plumber-sms": { title: "Messages", subtitle: "Pipeline · automated alerts" },
    "quote-review": {
      title: s.quoteMode === "edit" ? "Revise quote" : "Review quote",
      subtitle: `${defaultQuoteData.customer.name} · ${defaultQuoteData.quoteNumber}`,
      back: "quotes-queue",
    },
    "customer-sms": {
      title: "Customer view",
      subtitle: "Priya Ramaswamy · iPhone Messages",
      back: "today",
    },
  };

  const renderScreenHeader = (): ReactNode => {
    const h = HEADERS[s.currentScreen];
    const withBack = !!h.back;
    return (
      <div className={`app-header ${withBack ? "with-back" : ""}`}>
        {withBack && (
          <button className="back-btn" onClick={() => setScreen(h.back!)}>
            <i className="ti ti-chevron-left" />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div className="app-title" style={{ fontSize: withBack ? 18 : 22 }}>
            {h.title}
          </div>
          <div className="app-subtitle">{h.subtitle}</div>
        </div>
        {!withBack && (
          <>
            <button className="header-action" aria-label="Notifications">
              <i className="ti ti-bell" />
            </button>
            <button className="header-action" aria-label="Settings">
              <i className="ti ti-settings" />
            </button>
          </>
        )}
      </div>
    );
  };

  const renderContent = (): ReactNode => {
    switch (s.currentScreen) {
      case "today":
        return renderTodayContent();
      case "callbacks":
        return renderCallbacksContent();
      case "emergencies":
        return renderEmergenciesContent();
      case "quotes-queue":
        return renderQuotesQueueContent();
      case "pipeline":
        return renderPipelineContent();
      case "conv-detail":
        return renderConvDetailContent();
      case "calendar":
        return renderCalendarContent();
      case "plumber-sms":
        return renderPlumberSmsContent();
      case "quote-review":
        return renderQuoteReviewContent();
      case "customer-sms":
        return renderCustomerSmsContent();
    }
  };

  const renderBottomNav = (): ReactNode => {
    const navScreens: { id: ScreenId; icon: string; label: string; badge?: number; amber?: boolean }[] =
      [
        { id: "today", icon: "ti-home", label: "Today", badge: 4 },
        { id: "pipeline", icon: "ti-list-details", label: "Pipeline", badge: 12 },
        { id: "calendar", icon: "ti-calendar", label: "Calendar" },
        { id: "plumber-sms", icon: "ti-message", label: "Messages", badge: 3, amber: true },
      ];
    const activeId: ScreenId = (
      ["callbacks", "emergencies", "quotes-queue", "conv-detail", "quote-review"] as ScreenId[]
    ).includes(s.currentScreen)
      ? "today"
      : s.currentScreen === "customer-sms"
        ? "plumber-sms"
        : s.currentScreen;
    return (
      <div className="bottom-nav">
        {navScreens.map((n) => (
          <button
            key={n.id}
            className={`nav-btn ${n.id === activeId ? "active" : ""}`}
            onClick={() => setScreen(n.id)}
          >
            <i className={`ti ${n.icon}`} />
            <span>{n.label}</span>
            {n.badge && (
              <span className={`nav-badge ${n.amber ? "amber" : ""}`}>{n.badge}</span>
            )}
          </button>
        ))}
      </div>
    );
  };

  // ====================================================================
  // ROOT RENDER
  // ====================================================================

  return (
    <div className="dashboard-root">
      <div className="workspace">
        <div className="workspace-header">
          <div>
            <div className="ws-title">Pipeline — Jill&apos;s Plumbing · v2</div>
            <div
              style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}
            >
              Mobile prototype · use bottom nav inside the phone for navigation
            </div>
          </div>
          <div className="ws-screen-tabs">
            {SCREEN_TABS.map((t) => (
              <button
                key={t.id}
                className={`ws-tab ${s.currentScreen === t.id ? "active" : ""}`}
                onClick={() => setScreen(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="workspace-note">
          <strong>v2 changes:</strong> Scroll fixed on all screens (try scrolling Today to see trend
          metrics &amp; Next Up). Bottom nav added inside the phone. View shortcuts row restored on
          Today with Pipeline urgency-dot strip. Sparklines back on metric tiles. Revenue tile =
          3-way toggle (Quoted / Booked / Invoiced). Conversion tile = 2-way toggle (to Quote / to
          Booking). Time window now changes all data. Quote review now has tap-to-edit (tap any line
          item → enters Revise mode focused there). Notes + checklist added to drill-in detail
          cards. Closed conversations restored prominently on Pipeline screen.
        </div>

        <div className="device">
          <div className="device-screen">
            <div className="status-bar">
              <span>2:18</span>
              <div className="status-bar-right">
                <i className="ti ti-signal-4" />
                <i className="ti ti-wifi" />
                <i className="ti ti-battery-3" />
              </div>
            </div>
            {renderScreenHeader()}
            <div className="app-content">{renderContent()}</div>
            {renderBottomNav()}
          </div>
        </div>
      </div>

      <div className={`toast ${toast.show ? "show" : ""}`}>{toast.text}</div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Small helper components
// ----------------------------------------------------------------------

function DrillField({ label, value }: { label: string; value: string }) {
  return (
    <div className="drill-field">
      <span className="drill-field-label">{label}</span>
      <span className="drill-field-value">{value}</span>
    </div>
  );
}

function DayBookingRow({
  time,
  name,
  status,
  statusClass = "urg-pill-l3",
  done = false,
  rowStyle,
}: {
  time: string;
  name: string;
  status: string;
  statusClass?: string;
  done?: boolean;
  rowStyle?: CSSProperties;
}) {
  return (
    <div className="day-booking-row" style={rowStyle}>
      <div className="day-booking-time">{time}</div>
      <div
        className="day-booking-name"
        style={done ? { opacity: 0.5, textDecoration: "line-through" } : undefined}
      >
        {name}
      </div>
      <span className={`day-booking-urg ${statusClass}`}>{status}</span>
    </div>
  );
}

function ClosedRow({
  name,
  time,
  summary,
  level,
}: {
  name: string;
  time: string;
  summary: string;
  level: "l2" | "l3";
}) {
  return (
    <div className={`conv-row urg-${level}`} style={{ opacity: 0.85 }}>
      <div className="conv-top">
        <div className="conv-name">{name}</div>
        <div className="conv-time">{time}</div>
      </div>
      <div className="conv-summary">{summary}</div>
      <div className="conv-bottom">
        <span className="urg-label">{level.toUpperCase()}</span>
        <span className="status-pill">Done</span>
      </div>
    </div>
  );
}
