import { describe, expect, it } from "vitest";
import { calculateUsagePacing } from "../usage/pacing";
import { PROVIDER_MODULES } from "./index";
import type { ProviderModule, ProviderModuleMap } from "./module";
import {
  getPaceCapability,
  inferredMonthlyWindowMinutes,
  PACE_CAPABILITIES,
  resolveDynamicSlotTitle,
  resolveExtraWindowPace,
  resolveSlotPace,
} from "./paceCapabilities";

const legacyModules: ProviderModuleMap = {};

describe("inferredMonthlyWindowMinutes", () => {
  it("uses the previous calendar month in UTC, clamping the day", () => {
    expect(inferredMonthlyWindowMinutes("2026-03-31T00:00:00Z")).toBe(31 * 24 * 60);
    expect(inferredMonthlyWindowMinutes("2026-03-01T00:00:00Z")).toBe(28 * 24 * 60);
  });
});

describe("provider module pace and titles", () => {
  const now = Date.parse("2026-03-23T10:30:00Z");
  const fixture: ProviderModule = {
    metadata: {
      name: "Fixture",
      iconSlug: "fixture",
      brandColor: "#000000",
      usageSectionLabels: { primary: "Primary" },
    },
    pace: {
      resetWindowPace: { type: "unsupported" },
      inferredMonthlyDuration: { type: "unsupported" },
      sessionPaceWindowRule: { type: "windowDuration", minutes: 300 },
    },
    displayTitle: () => "Fixture window",
  };

  it("uses the module pace row when the provider sets one", () => {
    expect(getPaceCapability("fixture", { fixture })).toEqual(fixture.pace);
    expect(getPaceCapability("codex", legacyModules)).toEqual(PACE_CAPABILITIES.codex);
    expect(getPaceCapability("codex", { codex: { metadata: fixture.metadata } })).toEqual(PACE_CAPABILITIES.codex);
    expect(
      resolveSlotPace("fixture", "Primary", { windowMinutes: 300, resetsAt: "2026-03-23T12:00:00Z" }, now, {
        fixture,
      })?.context,
    ).toBe("session");
    expect(
      resolveSlotPace(
        "fixture",
        "Primary",
        { windowMinutes: 300, resetsAt: "2026-03-23T12:00:00Z" },
        now,
        legacyModules,
      ),
    ).toBeUndefined();
  });

  it("uses the module label instead of the shared title table", () => {
    const windows = {
      Primary: { present: true, usedPercent: 10 },
      Secondary: { present: false },
      Tertiary: { present: true, usedPercent: 10 },
    };
    const options = { windows, hasAgentDetailRow: false, now };
    expect(resolveDynamicSlotTitle("factory", "Primary", options, { factory: fixture })).toBe("Fixture window");
    expect(resolveDynamicSlotTitle("factory", "Primary", options, legacyModules)).toBe("5-hour");
  });
});

describe("resolveSlotPace", () => {
  const now = Date.parse("2026-03-23T10:30:00Z");

  it("does not session-pace OpenCode Go's 5-hour primary", () => {
    expect(
      resolveSlotPace(
        "opencodego",
        "Primary",
        { windowMinutes: 300, resetsAt: "2026-03-23T13:00:00Z" },
        now,
        PROVIDER_MODULES,
      ),
    ).toBeUndefined();
  });

  it("paces Amp only when the reset description is a renews-in countdown", () => {
    expect(
      resolveSlotPace(
        "amp",
        "Primary",
        { windowMinutes: 43_200, resetsAt: "2026-04-22T10:30:00Z", resetDescription: "renews in 12 days" },
        now,
        legacyModules,
      )?.context,
    ).toBe("window");
    expect(
      resolveSlotPace(
        "amp",
        "Primary",
        { windowMinutes: 43_200, resetsAt: "2026-04-22T10:30:00Z" },
        now,
        legacyModules,
      ),
    ).toBeUndefined();
  });

  it("session-paces Ollama windows of at most 5 hours and monthly-paces the sentinel", () => {
    expect(
      resolveSlotPace(
        "ollama",
        "Primary",
        { windowMinutes: 90, resetsAt: "2026-03-23T13:00:00Z" },
        now,
        PROVIDER_MODULES,
      )?.context,
    ).toBe("session");
    expect(
      resolveSlotPace(
        "ollama",
        "Primary",
        { windowMinutes: 10_080, resetsAt: "2026-03-28T10:30:00Z" },
        now,
        PROVIDER_MODULES,
      ),
    ).toBeUndefined();
    expect(
      resolveSlotPace(
        "ollama",
        "Primary",
        { windowMinutes: 43_200, resetsAt: "2026-04-22T10:30:00Z" },
        now,
        PROVIDER_MODULES,
      )?.windowMinutes,
    ).toBe(inferredMonthlyWindowMinutes("2026-04-22T10:30:00Z"));
  });

  it("does not generic-weekly-pace a factory tertiary, even mid-window", () => {
    expect(
      resolveSlotPace(
        "factory",
        "Tertiary",
        { windowMinutes: 43_200, resetsAt: "2026-04-12T10:30:00Z" },
        now,
        legacyModules,
      ),
    ).toBeUndefined();
  });

  it("rescored alibaba monthly sentinel is not 43_200 minutes", () => {
    const resolved = resolveSlotPace(
      "alibaba",
      "Tertiary",
      { windowMinutes: 43_200, resetsAt: "2026-04-22T10:30:00Z" },
      now,
      PROVIDER_MODULES,
    );
    expect(resolved?.context).toBe("window");
    expect(resolved?.windowMinutes).not.toBe(43_200);
    expect(resolved?.windowMinutes).toBe(inferredMonthlyWindowMinutes("2026-04-22T10:30:00Z"));
  });

  it("does not rewrite copilot duration when windowMinutes is present", () => {
    expect(
      resolveSlotPace(
        "copilot",
        "Primary",
        { windowMinutes: 10_080, resetsAt: "2026-03-31T00:00:00Z" },
        now,
        PROVIDER_MODULES,
      )?.windowMinutes,
    ).toBe(10_080);
  });

  it("paces a 31-day March window past the elapsed floor", () => {
    const reset = "2026-03-31T00:00:00Z";
    const resolved = resolveSlotPace("copilot", "Primary", { resetsAt: reset }, now, PROVIDER_MODULES);
    expect(resolved?.windowMinutes).toBe(31 * 24 * 60);
    expect(
      calculateUsagePacing(
        { usedPercent: 50, remainingPercent: 50, resetsAt: reset, windowMinutes: resolved?.windowMinutes },
        now,
        resolved?.defaultWindowMinutes,
      ),
    ).toMatchObject({ actualUsedPercent: 50 });
  });
});

describe("resolveExtraWindowPace", () => {
  const metadata = {
    name: "Fixture",
    iconSlug: "fixture",
    brandColor: "#000000",
    usageSectionLabels: { primary: "Primary" },
  };

  it("session-paces Codex and Antigravity 5-hour extras, weekly-paces 7-day extras", () => {
    expect(resolveExtraWindowPace("codex", { windowMinutes: 300 }, legacyModules)?.context).toBe("session");
    expect(resolveExtraWindowPace("antigravity", { windowMinutes: 300 }, PROVIDER_MODULES)?.context).toBe("session");
    expect(resolveExtraWindowPace("codex", { windowMinutes: 10_080 }, legacyModules)?.context).toBe("window");
    expect(resolveExtraWindowPace("claude", { windowMinutes: 10_080 }, legacyModules)?.context).toBe("window");
  });

  it("does not pace Claude or Cursor 5-hour extras or extras on other providers", () => {
    expect(resolveExtraWindowPace("claude", { windowMinutes: 300 }, legacyModules)).toBeUndefined();
    expect(resolveExtraWindowPace("cursor", { windowMinutes: 300 }, PROVIDER_MODULES)).toBeUndefined();
    expect(resolveExtraWindowPace("factory", { windowMinutes: 10_080 }, legacyModules)).toBeUndefined();
    expect(
      resolveExtraWindowPace("zai", { windowMinutes: 43_200, resetDescription: "MCP" }, legacyModules),
    ).toBeUndefined();
  });

  it("weekly-paces Cursor 7-day extras", () => {
    expect(resolveExtraWindowPace("cursor", { windowMinutes: 10_080 }, PROVIDER_MODULES)?.context).toBe("window");
  });

  it("lets a module extraWindowPace replace the legacy id sets", () => {
    const weeklyOnly = { claude: { metadata, extraWindowPace: "weekly-only" as const } };
    const sessionOrWeekly = { fixture: { metadata, extraWindowPace: "session-or-weekly" as const } };
    expect(resolveExtraWindowPace("claude", { windowMinutes: 300 }, weeklyOnly)).toBeUndefined();
    expect(resolveExtraWindowPace("claude", { windowMinutes: 10_080 }, weeklyOnly)?.context).toBe("window");
    expect(resolveExtraWindowPace("fixture", { windowMinutes: 300 }, sessionOrWeekly)?.context).toBe("session");
    expect(resolveExtraWindowPace("fixture", { windowMinutes: 10_080 }, sessionOrWeekly)?.context).toBe("window");
    expect(
      resolveExtraWindowPace(
        "claude",
        { windowMinutes: 300 },
        {
          claude: { metadata, extraWindowPace: "session-or-weekly" },
        },
      )?.context,
    ).toBe("session");
  });
});

describe("secondaryAllowsDefaultWindow", () => {
  it("is pinned to Codex only", () => {
    const ids = [...new Set([...Object.keys(PACE_CAPABILITIES), ...Object.keys(PROVIDER_MODULES)])]
      .filter((id) => getPaceCapability(id, PROVIDER_MODULES).secondaryAllowsDefaultWindow)
      .sort();
    expect(ids).toEqual(["codex"]);
  });
});
