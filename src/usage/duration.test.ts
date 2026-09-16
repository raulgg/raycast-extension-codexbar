import { describe, expect, it } from "vitest";
import { formatCountdown, formatDurationSeconds } from "./duration";

describe("formatCountdown", () => {
  const now = Date.parse("2026-03-23T10:30:00Z");

  it("rounds up to whole minutes and drops zero parts", () => {
    expect(formatCountdown("2026-03-23T10:30:01Z", now)).toBe("1m");
    expect(formatCountdown("2026-03-23T12:30:00Z", now)).toBe("2h");
    expect(formatCountdown("2026-03-23T12:35:00Z", now)).toBe("2h 5m");
  });

  it("stays in hours while the real remaining time is under a day", () => {
    expect(formatCountdown("2026-03-24T10:29:01Z", now)).toBe("24h");
    expect(formatCountdown("2026-03-24T10:30:00Z", now)).toBe("1d");
    expect(formatCountdown("2026-03-28T13:30:00Z", now)).toBe("5d 3h");
  });

  it("returns undefined once the target has passed or cannot be parsed", () => {
    expect(formatCountdown("2026-03-23T10:30:00Z", now)).toBeUndefined();
    expect(formatCountdown("not a date", now)).toBeUndefined();
  });
});

describe("formatDurationSeconds", () => {
  it("reads now at or below zero", () => {
    expect(formatDurationSeconds(0)).toBe("now");
    expect(formatDurationSeconds(-30)).toBe("now");
  });

  it("uses the same minute, hour, and day wording as the countdown", () => {
    expect(formatDurationSeconds(30)).toBe("1m");
    expect(formatDurationSeconds(2 * 3600 + 5 * 60)).toBe("2h 5m");
    expect(formatDurationSeconds(5 * 86400 + 3 * 3600)).toBe("5d 3h");
  });

  it("switches to days once the rounded minutes reach a full day", () => {
    expect(formatDurationSeconds(86340)).toBe("23h 59m");
    expect(formatDurationSeconds(86341)).toBe("1d");
  });
});
