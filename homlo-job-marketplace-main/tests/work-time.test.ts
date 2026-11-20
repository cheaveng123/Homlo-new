import { describe, expect, it } from "vitest";

import { formatPay } from "@/lib/job-record";
import {
  formatClock,
  formatWorkDays,
  formatWorkHours,
  formatWorkTime,
  isOvernight,
  normalizeClock,
  normalizeWorkDays,
  shiftHours,
} from "@/lib/work-time";

describe("work time formatting", () => {
  it("normalizes days into week order, dropping unknown values", () => {
    expect(normalizeWorkDays(["fri", "mon", "xyz", "Mon", "wednesday"])).toEqual(["mon", "wed", "fri"]);
    expect(normalizeWorkDays(null)).toEqual([]);
  });

  it("labels common day sets", () => {
    expect(formatWorkDays(["mon", "tue", "wed", "thu", "fri"])).toBe("Mon–Fri");
    expect(formatWorkDays(["sat", "sun"])).toBe("Sat & Sun");
    expect(formatWorkDays(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).toBe("Every day");
    expect(formatWorkDays(["mon", "wed", "fri"])).toBe("Mon, Wed, Fri");
    expect(formatWorkDays([])).toBeNull();
  });

  it("reads Postgres times and formats 12-hour clocks", () => {
    expect(normalizeClock("08:30:00")).toBe("08:30");
    expect(normalizeClock("25:00")).toBeNull();
    expect(formatClock("00:15")).toBe("12:15 AM");
    expect(formatClock("17:00")).toBe("5:00 PM");
    expect(formatWorkHours("08:00", "17:00")).toBe("8:00 AM – 5:00 PM");
    expect(formatWorkHours("08:00", null)).toBeNull();
  });

  it("handles overnight shifts", () => {
    expect(isOvernight("22:00", "06:00")).toBe(true);
    expect(shiftHours("22:00", "06:00")).toBe(8);
    expect(shiftHours("08:00", "17:30")).toBe(9.5);
  });

  it("joins days and hours, and returns null when both are N/A", () => {
    expect(formatWorkTime(["sat", "sun"], "09:00", "13:00")).toBe("Sat & Sun · 9:00 AM – 1:00 PM");
    expect(formatWorkTime(null, null, null)).toBeNull();
  });
});

describe("pay formatting", () => {
  it("shows a fixed amount when there is no higher maximum", () => {
    expect(formatPay({ pay_amount: 500, pay_amount_max: null, pay_currency: "USD", pay_type: "fixed" })).toBe("$500");
    expect(formatPay({ pay_amount: 500, pay_amount_max: 500, pay_currency: "USD", pay_type: "fixed" })).toBe("$500");
  });

  it("shows a range when pay_amount_max is above pay_amount", () => {
    expect(formatPay({ pay_amount: 3, pay_amount_max: "8", pay_currency: "USD", pay_type: "hourly" })).toBe("$3 – $8 / hour");
  });
});
