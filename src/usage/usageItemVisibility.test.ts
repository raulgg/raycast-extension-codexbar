import { describe, expect, it } from "vitest";
import type { ProviderSection } from "./types";
import {
  omitHiddenUsageItems,
  resolveUsageItemId,
  usageItemIdForSlot,
  usageItemIdFromMeterId,
} from "./usageItemVisibility";

const cursorSections: ProviderSection[] = [
  { kind: "usage", title: "Primary", displayTitle: "Total", remainingPercent: 94 },
  { kind: "usage", title: "Secondary", displayTitle: "Cursor", remainingPercent: 96 },
  { kind: "supplementalUsage", title: "Grok Bot", remainingPercent: 64, usageItemId: "metric:cursor-grok-bot" },
  { kind: "info", title: "Limit Reset Credits", items: [{ label: "Available", value: "1 available" }] },
];

describe("usage item visibility", () => {
  it("maps slot meters, Codex lanes, and presentation extra ids", () => {
    expect(usageItemIdForSlot("cursor", "Primary")).toBe("metric:primary");
    expect(usageItemIdForSlot("cursor", "Tertiary")).toBe("metric:tertiary");
    expect(usageItemIdForSlot("codex", "Primary", 5 * 60)).toBe("metric:primary");
    expect(usageItemIdForSlot("codex", "Primary", 30 * 24 * 60)).toBe("metric:monthly");
    expect(usageItemIdForSlot("codex", "Secondary")).toBe("metric:secondary");
    expect(usageItemIdFromMeterId("extra:claude-routines")).toBe("metric:claude-routines");
    expect(usageItemIdFromMeterId("codex-spark")).toBe("metric:codex-spark");
    expect(usageItemIdFromMeterId("section:credits")).toBe("section:credits");
    expect(usageItemIdFromMeterId("  ")).toBeUndefined();
  });

  it("falls back to slot and known section ids when a cached detail has none", () => {
    expect(resolveUsageItemId(cursorSections[0])).toBe("metric:primary");
    expect(resolveUsageItemId(cursorSections[3])).toBe("section:codex-reset-credits");
    expect(
      resolveUsageItemId({
        kind: "usage",
        title: "Primary",
        displayTitle: "Monthly",
        remainingPercent: 75,
        usageItemId: "metric:monthly",
      }),
    ).toBe("metric:monthly");
    expect(resolveUsageItemId({ kind: "supplementalUsage", title: "Code review", remainingPercent: 78 })).toBe(
      "metric:code-review",
    );
    expect(resolveUsageItemId({ kind: "supplementalUsage", title: "Grok Bot", remainingPercent: 64 })).toBeUndefined();
  });

  it("drops hidden items and leaves the rest in order", () => {
    expect(
      omitHiddenUsageItems(cursorSections, ["metric:primary", "section:codex-reset-credits"]).map((section) =>
        section.kind === "usage" ? section.displayTitle : section.title,
      ),
    ).toEqual(["Cursor", "Grok Bot"]);

    expect(omitHiddenUsageItems(cursorSections, [])).toBe(cursorSections);
    expect(omitHiddenUsageItems(cursorSections, ["metric:does-not-exist"])).toEqual(cursorSections);
  });
});
