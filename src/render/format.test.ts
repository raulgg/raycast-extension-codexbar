import { describe, expect, it } from "vitest";
import {
  formatLocalDateTime,
  formatPercentRemaining,
  formatRelativeUpdateTime,
  getRelativeUpdateTimeRefreshDelay,
} from "./format";

describe("format helpers", () => {
  it("formats remaining percent like upstream UsageFormatter.percentString", () => {
    expect(formatPercentRemaining(0)).toBe("0%");
    expect(formatPercentRemaining(0.1)).toBe("<1%");
    expect(formatPercentRemaining(0.4)).toBe("<1%");
    expect(formatPercentRemaining(0.6)).toBe("<1%");
    expect(formatPercentRemaining(0.96)).toBe("<1%");
    expect(formatPercentRemaining(1)).toBe("1%");
    expect(formatPercentRemaining(99.4)).toBe("99%");
    expect(formatPercentRemaining(-1)).toBe("0%");
    expect(formatPercentRemaining(101)).toBe("100%");
  });

  it("formats timestamps as compact local datetimes", () => {
    expect(formatLocalDateTime("2026-04-05T15:11:00.000Z", "en-US", "UTC")).toBe("Apr 5, 2026, 3:11 PM");
  });

  it("returns the raw timestamp when parsing fails", () => {
    expect(formatLocalDateTime("not-a-date")).toBe("not-a-date");
  });

  it("formats relative update timestamps with compact units", () => {
    const now = Date.parse("2026-04-05T15:11:00.000Z");

    expect(formatRelativeUpdateTime("2026-04-05T15:10:45.000Z", { now })).toBe("just now");
    expect(formatRelativeUpdateTime("2026-04-05T14:44:00.000Z", { now })).toBe("27m ago");
    expect(formatRelativeUpdateTime("2026-04-05T13:11:00.000Z", { now })).toBe("2h ago");
  });

  it("computes the next relative timestamp refresh boundary", () => {
    expect(getRelativeUpdateTimeRefreshDelay("2026-04-05T15:10:45.000Z", Date.parse("2026-04-05T15:11:00.000Z"))).toBe(
      45_000,
    );
    expect(getRelativeUpdateTimeRefreshDelay("2026-04-05T14:43:45.000Z", Date.parse("2026-04-05T15:11:00.000Z"))).toBe(
      45_000,
    );
    expect(getRelativeUpdateTimeRefreshDelay("2026-04-05T13:40:45.000Z", Date.parse("2026-04-05T15:11:00.000Z"))).toBe(
      1_785_000,
    );
  });
});
