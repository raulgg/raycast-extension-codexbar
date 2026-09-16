import { describe, expect, it } from "vitest";
import { clampPercent, isRecord, toFiniteNumber, toNonBlankString, toRecord, toTrimmedString } from "./json";

describe("json coercion helpers", () => {
  it("treats only plain objects as records", () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(toRecord("x")).toBeUndefined();
    expect(toRecord({ a: 1 })).toEqual({ a: 1 });
  });

  it("rejects blank strings and trims on request", () => {
    expect(toNonBlankString("  Session ")).toBe("  Session ");
    expect(toTrimmedString("  Session ")).toBe("Session");
    expect(toNonBlankString("   ")).toBeUndefined();
    expect(toTrimmedString(42)).toBeUndefined();
  });

  it("accepts only finite numbers", () => {
    expect(toFiniteNumber(12.5)).toBe(12.5);
    expect(toFiniteNumber(Number.NaN)).toBeUndefined();
    expect(toFiniteNumber("12")).toBeUndefined();
  });

  it("clamps percentages into 0..100", () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(42)).toBe(42);
    expect(clampPercent(140)).toBe(100);
  });
});
