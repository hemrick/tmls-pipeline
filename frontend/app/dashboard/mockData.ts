// Mock data for the Jill's Plumbing dashboard prototype.
// Ported from the v2 HTML mockup. Shapes will mirror the OpenAPI response
// types as backend endpoints come online.

// ---------- Types ----------

export type ScreenId =
  | "today"
  | "callbacks"
  | "emergencies"
  | "quotes-queue"
  | "pipeline"
  | "conv-detail"
  | "calendar"
  | "plumber-sms"
  | "quote-review"
  | "customer-sms";

export type TimeWindow = "today" | "7d" | "30d";
export type ConversionVariant = "quote" | "booking";
export type RevenueVariant = "quoted" | "booked" | "invoiced";
export type CalendarMode = "day" | "week" | "month";
export type QuoteMode = "review" | "edit";
export type AccordionPeriod = "7d" | "30d";

export type Tier0Stats = {
  l0: { count: number; age: string };
  l1: { count: number; age: string };
  quote: { count: number; age: string };
};

export type MetricBlock = { value: string | number; sub: string };

export type MetricsSnapshot = {
  newConv: MetricBlock;
  bookings: MetricBlock;
  conversion: { quote: MetricBlock; booking: MetricBlock };
  revenue: { quoted: MetricBlock; booked: MetricBlock; invoiced: MetricBlock };
};

export type QuoteLineItem = { desc: string; qty: number; amount: number };

export type QuoteData = {
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  quoteNumber: string;
  date: string;
  validUntil: string;
  problem: string;
  materials: QuoteLineItem[];
  labour: QuoteLineItem[];
  taxRate: number;
};

export type ChecklistMap = Record<string, boolean>;
export type NotesEntry = { text: string; checklist: ChecklistMap };
export type NotesData = Record<string, NotesEntry>;

export type FocusedField = {
  section: "problem" | "materials" | "labour";
  idx: number | null;
  field: "desc" | null;
} | null;

export type DashboardState = {
  currentScreen: ScreenId;
  timeWindow: TimeWindow;
  timeWindowMenuOpen: boolean;
  dayOffset: number;
  conversionAccordion: boolean;
  revenueAccordion: boolean;
  conversionPeriod: AccordionPeriod;
  revenuePeriod: AccordionPeriod;
  conversionVariant: ConversionVariant;
  revenueVariant: RevenueVariant;
  todayJobsExpanded: boolean;
  closedExpanded: boolean;
  calendarMode: CalendarMode;
  selectedCalDay: number | null;
  quoteMode: QuoteMode;
  showRejectModal: boolean;
  quoteEdits: QuoteData | null;
  focusedField: FocusedField;
  notesData: NotesData;
};

export const initialState: DashboardState = {
  currentScreen: "today",
  timeWindow: "today",
  timeWindowMenuOpen: false,
  dayOffset: 0,
  conversionAccordion: false,
  revenueAccordion: false,
  conversionPeriod: "7d",
  revenuePeriod: "7d",
  conversionVariant: "booking",
  revenueVariant: "quoted",
  todayJobsExpanded: false,
  closedExpanded: false,
  calendarMode: "month",
  selectedCalDay: null,
  quoteMode: "review",
  showRejectModal: false,
  quoteEdits: null,
  focusedField: null,
  notesData: {
    marta: {
      text: "",
      checklist: {
        called: false,
        voicemail: false,
        enbridge_confirmed: false,
        rescheduled: false,
        closed: false,
      },
    },
    james: {
      text: "",
      checklist: {
        called: false,
        voicemail: false,
        sub_assigned: false,
        eta_given: false,
        closed: false,
      },
    },
  },
};

// ---------- Time-window-aware data ----------

export type TimeWindowEntry = {
  label: (dayOffset: number) => string;
  tier0: (dayOffset: number) => Tier0Stats;
  metrics: (dayOffset: number) => MetricsSnapshot;
};

const emptyMetrics: MetricsSnapshot = {
  newConv: { value: 0, sub: "—" },
  bookings: { value: 0, sub: "—" },
  conversion: { quote: { value: "—", sub: "—" }, booking: { value: "—", sub: "—" } },
  revenue: {
    quoted: { value: "—", sub: "—" },
    booked: { value: "—", sub: "—" },
    invoiced: { value: "—", sub: "—" },
  },
};

export const timeWindowData: Record<TimeWindow, TimeWindowEntry> = {
  today: {
    label: (dayOffset) => {
      if (dayOffset === 0) return "Today · Tue, May 26";
      if (dayOffset === -1) return "Yesterday · Mon, May 25";
      if (dayOffset === 1) return "Tomorrow · Wed, May 27";
      const date = new Date(2026, 4, 26 + dayOffset);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    },
    tier0: (dayOffset) => {
      if (dayOffset === 0) {
        return {
          l0: { count: 1, age: "Oldest: 4 min ago" },
          l1: { count: 1, age: "Oldest: 12 min ago" },
          quote: { count: 2, age: "Oldest: 38 min ago" },
        };
      }
      return { l0: { count: 0, age: "—" }, l1: { count: 0, age: "—" }, quote: { count: 0, age: "—" } };
    },
    metrics: (dayOffset) => {
      if (dayOffset === 0) {
        return {
          newConv: { value: 9, sub: "L1: 1 · L2: 3 · L3: 4 · L0: 1" },
          bookings: { value: 5, sub: "3 done · 2 ahead" },
          conversion: {
            quote: { value: "78%", sub: "7 of 9 → quoted" },
            booking: { value: "67%", sub: "6 of 9 → booked" },
          },
          revenue: {
            quoted: { value: "$3,840", sub: "4 quotes today" },
            booked: { value: "$2,295", sub: "3 of 4 confirmed" },
            invoiced: { value: "$1,420", sub: "3 jobs completed" },
          },
        };
      }
      if (dayOffset === -1) {
        return {
          newConv: { value: 12, sub: "L1: 0 · L2: 4 · L3: 7 · L0: 1" },
          bookings: { value: 7, sub: "All complete" },
          conversion: {
            quote: { value: "83%", sub: "10 of 12 → quoted" },
            booking: { value: "58%", sub: "7 of 12 → booked" },
          },
          revenue: {
            quoted: { value: "$3,480", sub: "5 quotes" },
            booked: { value: "$3,290", sub: "4 of 5 confirmed" },
            invoiced: { value: "$2,940", sub: "7 jobs completed" },
          },
        };
      }
      if (dayOffset === 1) {
        return {
          newConv: { value: 0, sub: "Tomorrow" },
          bookings: { value: 4, sub: "Scheduled" },
          conversion: {
            quote: { value: "—", sub: "No data" },
            booking: { value: "—", sub: "No data" },
          },
          revenue: {
            quoted: { value: "—", sub: "No data yet" },
            booked: { value: "$2,180", sub: "4 jobs booked" },
            invoiced: { value: "—", sub: "Future date" },
          },
        };
      }
      return emptyMetrics;
    },
  },
  "7d": {
    label: () => "Last 7 days",
    tier0: () => ({
      l0: { count: 1, age: "Oldest: 4 min ago" },
      l1: { count: 1, age: "Oldest: 12 min ago" },
      quote: { count: 2, age: "Oldest: 38 min ago" },
    }),
    metrics: () => ({
      newConv: { value: 64, sub: "L1: 4 · L2: 18 · L3: 39 · L0: 3" },
      bookings: { value: 38, sub: "36 done · 2 ahead" },
      conversion: {
        quote: { value: "80%", sub: "51 of 64 → quoted" },
        booking: { value: "61%", sub: "39 of 64 → booked" },
      },
      revenue: {
        quoted: { value: "$18,420", sub: "23 quotes" },
        booked: { value: "$14,280", sub: "18 of 23 won" },
        invoiced: { value: "$11,840", sub: "15 jobs paid" },
      },
    }),
  },
  "30d": {
    label: () => "Last 30 days",
    tier0: () => ({
      l0: { count: 1, age: "Oldest: 4 min ago" },
      l1: { count: 1, age: "Oldest: 12 min ago" },
      quote: { count: 2, age: "Oldest: 38 min ago" },
    }),
    metrics: () => ({
      newConv: { value: 247, sub: "L1: 14 · L2: 71 · L3: 154 · L0: 8" },
      bookings: { value: 152, sub: "149 done · 3 ahead" },
      conversion: {
        quote: { value: "77%", sub: "190 of 247 → quoted" },
        booking: { value: "62%", sub: "153 of 247 → booked" },
      },
      revenue: {
        quoted: { value: "$72,840", sub: "92 quotes" },
        booked: { value: "$56,420", sub: "72 of 92 won" },
        invoiced: { value: "$48,320", sub: "63 jobs paid" },
      },
    }),
  },
};

// ---------- Quote demo data ----------

export const quoteData: QuoteData = {
  customer: {
    name: "Priya Ramaswamy",
    phone: "+1 (905) 555-0273",
    email: "priya.r@email.com",
    address: "184 Cherrywood Ave, Etobicoke, ON M9A 2T9",
  },
  quoteNumber: "JP-2026-0341",
  date: "May 26, 2026",
  validUntil: "June 9, 2026",
  problem:
    "Toilet replacement — master bathroom. Existing two-piece toilet leaking at base; flange in serviceable condition; customer supplying new fixture (Toto Drake II in white).",
  materials: [
    { desc: "Wax ring with horn (premium)", qty: 1, amount: 12 },
    { desc: "Toilet bolts and caps, brass", qty: 1, amount: 8 },
    { desc: "Shut-off valve replacement (1/4-turn ball valve, 3/8\")", qty: 1, amount: 24 },
    { desc: "Braided stainless supply line, 12\"", qty: 1, amount: 18 },
    { desc: "Toilet flange repair ring (precautionary)", qty: 1, amount: 16 },
    { desc: "Caulk (white silicone, mildew-resistant)", qty: 1, amount: 9 },
    { desc: "Misc. fasteners and shims", qty: 1, amount: 8 },
  ],
  labour: [
    { desc: "Remove existing toilet, inspect flange and waste pipe", qty: 1, amount: 110 },
    { desc: "Install new toilet (customer-supplied), seal and test", qty: 1, amount: 165 },
    { desc: "Replace shut-off valve and supply line", qty: 1, amount: 75 },
    { desc: "Caulk, clean-up, haul-away of old fixture", qty: 1, amount: 55 },
  ],
  taxRate: 0.13,
};

// ---------- Sparkline series ----------

export const sparkSeries: Record<string, number[]> = {
  conversion_quote_7d: [72, 75, 78, 76, 79, 81, 80],
  conversion_quote_30d: [
    68, 70, 72, 71, 73, 75, 74, 76, 78, 75, 77, 79, 80, 78, 76, 78, 80, 82, 80, 78, 79, 81, 80, 78,
    80, 82, 79, 80, 81, 80,
  ],
  conversion_booking_7d: [55, 58, 62, 60, 57, 64, 67],
  conversion_booking_30d: [
    42, 45, 48, 50, 52, 55, 53, 58, 60, 57, 62, 65, 63, 60, 64, 66, 68, 65, 67, 64, 62, 65, 67, 64,
    63, 65, 68, 64, 67, 67,
  ],
  revenue_quoted_7d: [2100, 2680, 1840, 3220, 2950, 3480, 3840],
  revenue_quoted_30d: [
    1800, 2100, 2400, 2200, 2680, 1900, 2300, 2680, 2100, 2900, 3120, 2840, 3340, 3100, 2700, 3220,
    2950, 2480, 3480, 3140, 3290, 3540, 3220, 2810, 3680, 3420, 3140, 3520, 3760, 3840,
  ],
  revenue_booked_7d: [1680, 2100, 1340, 2520, 2350, 2680, 2880],
  revenue_booked_30d: [
    1400, 1620, 1900, 1700, 2080, 1500, 1800, 2080, 1700, 2300, 2420, 2240, 2640, 2400, 2100, 2520,
    2350, 1900, 2680, 2440, 2540, 2740, 2520, 2210, 2880, 2680, 2440, 2740, 2920, 2880,
  ],
  revenue_invoiced_7d: [1400, 1880, 1100, 2200, 2050, 2380, 2580],
  revenue_invoiced_30d: [
    1200, 1380, 1620, 1480, 1780, 1300, 1540, 1820, 1480, 2020, 2140, 1960, 2340, 2120, 1840, 2240,
    2080, 1670, 2380, 2160, 2240, 2440, 2240, 1950, 2580, 2380, 2140, 2440, 2620, 2580,
  ],
};
