import { describe, expect, it } from "vitest";
import { extractSvgMarkup, markerFills, parseSvg, rectsWithSize, textY } from "../../test/svg-markdown";
import { buildProviderDetailMarkdown } from "../render/detailCard";
import { PROVIDER_MODULES } from "../providers/index";
import { METER_DETAIL } from "../providers/meterDetail";
import type { ProviderModule } from "../providers/module";
import { extractProviderErrorMessage, normalizeProviderDetailPayload } from "./normalize";
import { formatUsagePacingLine } from "./pacing";
import type { ProviderSection, ProviderUsagePacing, ProviderUsageSection } from "./types";

const codexPayload = {
  provider: "codex",
  usage: {
    primary: {
      windowMinutes: 300,
      usedPercent: 47,
      resetsAt: "2026-03-23T12:00:00Z",
    },
    secondary: {
      windowMinutes: 10080,
      usedPercent: 12,
      resetsAt: "2026-03-30T08:00:00Z",
    },
    accountEmail: "dev@example.com",
    loginMethod: "pro",
  },
  credits: {
    remaining: 112.4,
  },
  openaiDashboard: {
    updatedAt: "2026-03-23T09:00:00Z",
    codeReviewRemainingPercent: 78,
  },
} as const;

describe("provider normalization", () => {
  it("prefers canonical GUI presentation meters over legacy provider windows", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "claude",
        source: "oauth",
        presentation: {
          schemaVersion: 1,
          meters: [
            {
              id: "primary",
              kind: "primary",
              label: "Session",
              usedPercent: 15,
              remainingPercent: 85,
              windowMinutes: 300,
              resetsAt: "2026-03-23T12:00:00Z",
            },
            {
              id: "extra:claude-routines",
              kind: "supplemental",
              label: "Daily Routines",
              usedPercent: 30,
              remainingPercent: 70,
              windowMinutes: 10_080,
              resetsAt: "2026-03-30T10:30:00Z",
            },
          ],
        },
        usage: {
          primary: { usedPercent: 99 },
          secondary: { usedPercent: 99 },
        },
      },
      "claude",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(detail.source).toBe("oauth");
    expect(detail.presentationSchemaVersion).toBe(1);
    expect(detail.sections).toMatchObject([
      { kind: "usage", title: "Primary", displayTitle: "Session", remainingPercent: 85, resetsIn: "1h 30m" },
      { kind: "supplementalUsage", title: "Daily Routines", remainingPercent: 70, resetsIn: "7d" },
    ]);
    expect(detail.sections.map((section) => section.usageItemId)).toEqual(["metric:primary", "metric:claude-routines"]);
    expect(detail.sections).toHaveLength(2);
  });

  it("stamps Codex lane, extra-window, code-review, and reset-credit ids", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "codex",
        usage: {
          primary: { usedPercent: 25, windowMinutes: 30 * 24 * 60 },
          secondary: { usedPercent: 10, windowMinutes: 7 * 24 * 60 },
          extraRateWindows: [{ id: "codex-spark", title: "Codex Spark", window: { usedPercent: 5 } }],
          codexResetCredits: { credits: [{ status: "available" }] },
        },
        openaiDashboard: { codeReviewRemainingPercent: 40 },
      },
      "codex",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(detail.sections.map((section) => section.usageItemId)).toEqual([
      "metric:monthly",
      "metric:secondary",
      "metric:codex-spark",
      "metric:code-review",
      "section:codex-reset-credits",
    ]);
  });

  it("renders presentation meters for a provider the catalog does not list", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "some-new-provider",
        presentation: {
          schemaVersion: 1,
          meters: [
            {
              kind: "primary",
              label: "Session",
              usedPercent: 15,
              remainingPercent: 85,
              windowMinutes: 300,
              resetsAt: "2026-03-23T12:00:00Z",
            },
          ],
        },
        usage: {
          primary: { usedPercent: 99 },
        },
      },
      "some-new-provider",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(detail).toMatchObject({ id: "some-new-provider", name: "Some New Provider" });
    expect(detail.sections).toHaveLength(1);
    expect(detail.sections).toMatchObject([
      {
        kind: "usage",
        title: "Primary",
        displayTitle: "Session",
        remainingPercent: 85,
        resetsIn: "1h 30m",
        usagePacing: undefined,
      },
    ]);
  });

  it("labels raw windows with fallback titles for a provider the catalog does not list", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "some-new-provider",
        usage: {
          primary: { usedPercent: 20, resetsAt: "2026-03-23T12:00:00Z" },
          secondary: { usedPercent: 40, windowMinutes: 10_080, resetsAt: "2026-03-30T08:00:00Z" },
          tertiary: { usedPercent: 10 },
        },
      },
      "some-new-provider",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(detail.sections).toHaveLength(3);
    expect(detail.sections).toMatchObject([
      {
        kind: "usage",
        title: "Primary",
        displayTitle: "Primary",
        remainingPercent: 80,
        resetsIn: "1h 30m",
        usagePacing: undefined,
      },
      { kind: "usage", title: "Secondary", displayTitle: "Secondary", remainingPercent: 60, usagePacing: undefined },
      { kind: "usage", title: "Tertiary", displayTitle: "Tertiary", remainingPercent: 90, usagePacing: undefined },
    ]);
  });

  it("refuses a roster that does not contain the requested provider", () => {
    expect(() =>
      normalizeProviderDetailPayload(
        [
          { provider: "codex", accountEmail: "dev@example.com", usage: { primary: { usedPercent: 47 } } },
          { provider: "claude", usage: { primary: { usedPercent: 12 } } },
        ],
        "some-new-provider",
      ),
    ).toThrow("CodexBar did not return usage for some-new-provider.");
  });

  it("normalizes a payload that has no provider id", () => {
    const detail = normalizeProviderDetailPayload({ usage: { primary: { usedPercent: 20 } } }, "some-new-provider");

    expect(detail).toMatchObject({ id: "some-new-provider", name: "Some New Provider" });
    expect(detail.sections[0]).toMatchObject({ kind: "usage", remainingPercent: 80 });
  });

  it("treats an empty canonical meter list as authoritative", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "codex",
        presentation: { schemaVersion: 1, meters: [] },
        usage: { primary: { usedPercent: 20 } },
      },
      "codex",
    );

    expect(detail.sections).toEqual([]);
  });

  it("treats an empty schema 2 meter list as authoritative", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "codex",
        presentation: { schemaVersion: 2, meters: [] },
        usage: { primary: { usedPercent: 20 } },
      },
      "codex",
    );

    expect(detail.presentationSchemaVersion).toBe(2);
    expect(detail.sections).toEqual([]);
  });

  it("falls through to raw usage for a presentation schema it does not know", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "raycast",
        presentation: {
          schemaVersion: 3,
          meters: [
            {
              kind: "primary",
              label: "Ignored",
              remainingPercent: 1,
              metaText: "from schema 3",
              detailText: "from schema 3",
            },
          ],
        },
        usage: { primary: { usedPercent: 33, resetDescription: "336.73 / 500 credits left" } },
      },
      "raycast",
    );

    expect(detail.presentationSchemaVersion).toBeUndefined();
    expect(detail.sections[0]).toMatchObject({
      kind: "usage",
      remainingPercent: 67,
      detailText: "336.73 / 500 credits left",
    });
    expect(detail.sections[0]).not.toHaveProperty("metaText");
  });

  it("preserves fractional remaining percent through normalize", () => {
    const fromUsed = normalizeProviderDetailPayload(
      {
        provider: "codex",
        usage: {
          primary: { usedPercent: 99.5 },
          secondary: { usedPercent: 58 },
        },
      },
      "codex",
    );
    expect(fromUsed.sections[0]).toMatchObject({ kind: "usage", title: "Primary", remainingPercent: 0.5 });

    const fromExplicit = normalizeProviderDetailPayload(
      {
        provider: "claude",
        sessionPercentLeft: 0.4,
      },
      "claude",
    );
    expect(fromExplicit.sections[0]).toMatchObject({ kind: "usage", title: "Primary", remainingPercent: 0.4 });

    const fromFraction = normalizeProviderDetailPayload(
      {
        provider: "claude",
        remainingFraction: 0.004,
      },
      "claude",
    );
    expect(fromFraction.sections[0]).toMatchObject({ kind: "usage", title: "Primary", remainingPercent: 0.4 });
  });

  it("normalizes generic provider detail sections", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const detail = normalizeProviderDetailPayload(codexPayload, "codex", now);
    const markdown = buildProviderDetailMarkdown(detail, undefined, { now });
    const [detailSvg] = extractSvgMarkup(markdown);
    const expectedHeaderUpdated = "1h ago";

    expect(detail.id).toBe("codex");
    expect(detail.name).toBe("Codex");
    expect(detail.updatedAt).toBe("2026-03-23T09:00:00Z");
    expect(detail.accountEmail).toBe("dev@example.com");
    expect(detail.planText).toBe("Pro");
    expect(detail.sections).toMatchObject([
      {
        kind: "usage",
        title: "Primary",
        displayTitle: "Session",
        remainingPercent: 53,
        resetsIn: "1h 30m",
      },
      {
        kind: "usage",
        title: "Secondary",
        displayTitle: "Weekly",
        remainingPercent: 88,
        resetsIn: "6d 21h",
      },
      {
        kind: "supplementalUsage",
        title: "Code review",
        remainingPercent: 78,
      },
    ]);
    expect(markdown).toContain("data:image/svg+xml;base64,");
    expect(markdown).not.toContain("prefers-color-scheme");
    expect(detailSvg).not.toContain("dominant-baseline");
    expect(markdown).not.toContain("## Primary");
    expect(markdown).not.toContain("- **Remaining:**");
    expect(detailSvg).toContain("<title>Codex detail</title>");
    expect(detailSvg).toContain(">Codex<");
    expect(detailSvg).toContain(">dev@example.com<");
    expect(detailSvg).toContain(">Pro<");
    expect(detailSvg).toContain(`>Updated ${expectedHeaderUpdated}<`);
    expect(detailSvg).toContain(">Session 53% left<");
    expect(detailSvg).toContain(">Weekly 88% left<");
    expect(detailSvg).toContain(">Resets in 1h 30m");
    expect(detailSvg).toContain(">Code review 78% left<");
    // Credits, Cost, and General are no longer surfaced — usage meters only.
    expect(detailSvg).not.toContain(">Credits<");
    expect(detailSvg).not.toContain(">General<");
    expect(detailSvg.match(/<line /g)).toHaveLength(1);
    expect(detailSvg).toContain('width="440"');
  });

  it("falls back to session and weekly fields when usage windows are absent", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const detail = normalizeProviderDetailPayload(
      {
        provider: "claude",
        sessionPercentLeft: 80,
        sessionResetsAt: "2026-03-23T11:00:00Z",
        weeklyPercentLeft: 55,
        weeklyResetsAt: "2026-03-24T12:00:00Z",
      },
      "claude",
      now,
    );
    const markdown = buildProviderDetailMarkdown(detail, undefined, { now });
    const [detailSvg] = extractSvgMarkup(markdown);

    expect(detail.sections).toMatchObject([
      {
        kind: "usage",
        title: "Primary",
        displayTitle: "Session",
        remainingPercent: 80,
        resetsIn: "30m",
      },
      {
        kind: "usage",
        title: "Secondary",
        displayTitle: "Weekly",
        remainingPercent: 55,
        resetsIn: "1d 1h",
      },
    ]);
    expect(markdown).toContain("data:image/svg+xml;base64,");
    expect(detailSvg).toContain(">Session 80% left<");
    expect(detailSvg).toContain(">Weekly 55% left<");
    expect(detailSvg).toContain(">Resets in 1d 1h<");
  });

  it("relabels grok's primary bar by window length like the upstream GUI", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const usageTitles = (usage: Record<string, unknown>) =>
      normalizeProviderDetailPayload({ provider: "grok", usage }, "grok", now)
        .sections.filter((section) => section.kind === "usage")
        .map((section) => (section.kind === "usage" ? section.displayTitle : section.title));

    // Explicit weekly window wins over the static "Credits" label.
    expect(usageTitles({ primary: { windowMinutes: 10_080, usedPercent: 40 } })).toEqual(["Weekly"]);
    // Without windowMinutes, the distance to resetsAt decides: ~30 days → Monthly.
    expect(usageTitles({ primary: { usedPercent: 40, resetsAt: "2026-04-22T10:30:00Z" } })).toEqual(["Monthly"]);
    // Short explicit windows keep the static label.
    expect(usageTitles({ primary: { windowMinutes: 30, usedPercent: 40 } })).toEqual(["Credits"]);
    expect(usageTitles({ primary: { usedPercent: 40 } })).toEqual(["Credits"]);
    // Untyped window with a reset date stays Weekly even at ~2 weeks or ~2 days.
    expect(usageTitles({ primary: { usedPercent: 40, resetsAt: "2026-04-06T10:30:00Z" } })).toEqual(["Weekly"]);
    expect(usageTitles({ primary: { usedPercent: 40, resetsAt: "2026-03-25T10:30:00Z" } })).toEqual(["Weekly"]);
  });

  it("relabels doubao's primary bar as Requests for windowless request-style payloads", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const usageTitles = (usage: Record<string, unknown>) =>
      normalizeProviderDetailPayload({ provider: "doubao", usage }, "doubao", now)
        .sections.filter((section) => section.kind === "usage")
        .map((section) => (section.kind === "usage" ? section.displayTitle : section.title));

    // No window + request-style reset detail → pay-as-you-go account.
    expect(usageTitles({ primary: { usedPercent: 40, resetDescription: "1,200 requests left" } })).toEqual([
      "Requests",
    ]);
    // An explicit window means the regular 5h plan window, whatever the detail says.
    expect(
      usageTitles({ primary: { windowMinutes: 300, usedPercent: 40, resetDescription: "1,200 requests left" } }),
    ).toEqual(["5-hour"]);
    expect(usageTitles({ primary: { usedPercent: 40 } })).toEqual(["5-hour"]);
  });

  it("relabels Codex windows by cadence like CodexConsumerProjection.rateTitle", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const usageTitles = (usage: Record<string, unknown>) =>
      normalizeProviderDetailPayload({ provider: "codex", usage }, "codex", now)
        .sections.filter((section) => section.kind === "usage")
        .map((section) => (section.kind === "usage" ? section.displayTitle : section.title));

    expect(usageTitles({ primary: { windowMinutes: 300, usedPercent: 10 } })).toEqual(["Session"]);
    expect(usageTitles({ primary: { windowMinutes: 10_080, usedPercent: 10 } })).toEqual(["Weekly"]);
    expect(usageTitles({ primary: { windowMinutes: 43_200, usedPercent: 10 } })).toEqual(["Monthly"]);
    expect(
      usageTitles({
        primary: { windowMinutes: 43_200, usedPercent: 10 },
        secondary: { windowMinutes: 300, usedPercent: 20 },
      }),
    ).toEqual(["Monthly", "Session"]);
    expect(usageTitles({ primary: { usedPercent: 10 }, secondary: { usedPercent: 20 } })).toEqual([
      "Session",
      "Weekly",
    ]);
  });

  it("relabels factory windows as 5-hour/Weekly/Monthly when a tertiary window is present", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const usageTitles = (usage: Record<string, unknown>) =>
      normalizeProviderDetailPayload({ provider: "factory", usage }, "factory", now)
        .sections.filter((section) => section.kind === "usage")
        .map((section) => (section.kind === "usage" ? section.displayTitle : section.title));

    expect(
      usageTitles({ primary: { usedPercent: 10 }, secondary: { usedPercent: 20 }, tertiary: { usedPercent: 30 } }),
    ).toEqual(["5-hour", "Weekly", "Monthly"]);
    expect(usageTitles({ primary: { usedPercent: 10 }, secondary: { usedPercent: 20 } })).toEqual([
      "Standard",
      "Premium",
    ]);
  });

  it("relabels a present Mistral primary window as Included API", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const usageTitles = (usage: Record<string, unknown>) =>
      normalizeProviderDetailPayload({ provider: "mistral", usage }, "mistral", now)
        .sections.filter((section) => section.kind === "usage")
        .map((section) => (section.kind === "usage" ? section.displayTitle : section.title));

    expect(usageTitles({ primary: { usedPercent: 10 } })).toEqual(["Included API"]);

    const sessionOnly = normalizeProviderDetailPayload(
      { provider: "mistral", sessionPercentLeft: 40 },
      "mistral",
      now,
    ).sections.filter((section) => section.kind === "usage");
    expect(sessionOnly.map((section) => (section.kind === "usage" ? section.displayTitle : section.title))).toEqual([
      "Balance",
    ]);
  });

  it("relabels a 30-day Qwen Cloud primary as Monthly", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const usageTitles = (usage: Record<string, unknown>) =>
      normalizeProviderDetailPayload({ provider: "qwencloud", usage }, "qwencloud", now)
        .sections.filter((section) => section.kind === "usage")
        .map((section) => (section.kind === "usage" ? section.displayTitle : section.title));

    expect(usageTitles({ primary: { windowMinutes: 43_200, usedPercent: 10 } })).toEqual(["Monthly"]);
    expect(usageTitles({ primary: { windowMinutes: 300, usedPercent: 10 } })).toEqual(["5-hour"]);
  });

  it("relabels a StepFun credit plan primary as Credit when no secondary window is present", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const usageTitles = (usage: Record<string, unknown>) =>
      normalizeProviderDetailPayload({ provider: "stepfun", usage }, "stepfun", now)
        .sections.filter((section) => section.kind === "usage")
        .map((section) => (section.kind === "usage" ? section.displayTitle : section.title));

    expect(usageTitles({ primary: { usedPercent: 10 } })).toEqual(["Credit"]);
    expect(usageTitles({ primary: { usedPercent: 10 }, secondary: { usedPercent: 20 } })).toEqual([
      "5h Window",
      "Weekly Window",
    ]);
    expect(usageTitles({ primary: { usedPercent: 10 }, secondary: {} })).toEqual(["5h Window"]);
  });

  it("keeps Helmcode's account organization for the dashboard host switch", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "helmcode",
        usage: { identity: { accountOrganization: "NaN Builders" }, primary: { usedPercent: 10 } },
      },
      "helmcode",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(detail.accountOrganization).toBe("NaN Builders");
  });

  it("relabels amp windows as Other usage / Orb usage when a secondary window is present", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const usageTitles = (usage: Record<string, unknown>) =>
      normalizeProviderDetailPayload({ provider: "amp", usage }, "amp", now)
        .sections.filter((section) => section.kind === "usage")
        .map((section) => (section.kind === "usage" ? section.displayTitle : section.title));

    expect(usageTitles({ primary: { usedPercent: 10 } })).toEqual(["Amp Free"]);
    expect(usageTitles({ primary: { usedPercent: 10 }, secondary: { usedPercent: 20 } })).toEqual([
      "Other usage",
      "Orb usage",
    ]);
  });

  it("relabels amp primary as Agent usage when an Agent detail row is present", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const detail = normalizeProviderDetailPayload(
      {
        provider: "amp",
        usage: {
          primary: { usedPercent: 10 },
          details: [{ title: "Monthly allowances", rows: [{ label: "Agent", value: "$12" }] }],
        },
      },
      "amp",
      now,
    );
    const titles = detail.sections
      .filter((section) => section.kind === "usage")
      .map((section) => (section.kind === "usage" ? section.displayTitle : section.title));
    expect(titles).toEqual(["Agent usage"]);
  });

  it("relabels ollama's monthly-sentinel primary as Monthly", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const detail = normalizeProviderDetailPayload(
      {
        provider: "ollama",
        usage: { primary: { usedPercent: 10, windowMinutes: 43_200 } },
      },
      "ollama",
      now,
    );
    expect(detail.sections[0]).toMatchObject({ kind: "usage", displayTitle: "Monthly" });
  });

  it("relabels alibaba token-plan windows by duration", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const usageTitles = (usage: Record<string, unknown>) =>
      normalizeProviderDetailPayload({ provider: "alibabatokenplan", usage }, "alibabatokenplan", now)
        .sections.filter((section) => section.kind === "usage")
        .map((section) => (section.kind === "usage" ? section.displayTitle : section.title));

    expect(usageTitles({ primary: { usedPercent: 10 }, secondary: { usedPercent: 20 } })).toEqual(["Credits", "Usage"]);
    expect(
      usageTitles({
        primary: { windowMinutes: 300, usedPercent: 10 },
        secondary: { windowMinutes: 10_080, usedPercent: 20 },
      }),
    ).toEqual(["5-hour", "7-day"]);
  });

  it("relabels sub2api's primary bar as Daily quota when a secondary window is present", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const usageTitles = (usage: Record<string, unknown>) =>
      normalizeProviderDetailPayload({ provider: "sub2api", usage }, "sub2api", now)
        .sections.filter((section) => section.kind === "usage")
        .map((section) => (section.kind === "usage" ? section.displayTitle : section.title));

    expect(usageTitles({ primary: { usedPercent: 10 } })).toEqual(["Quota"]);
    expect(
      usageTitles({
        primary: { usedPercent: 10 },
        secondary: { usedPercent: 20 },
        tertiary: { usedPercent: 30 },
      }),
    ).toEqual(["Daily quota", "Weekly quota", "Monthly quota"]);
  });

  it("attaches raw usage pacing to supported weekly sections and renders GUI-style footers", () => {
    const now = Date.parse("2026-04-16T12:30:00Z");
    const detail = normalizeProviderDetailPayload(
      {
        provider: "codex",
        usage: {
          secondary: {
            windowMinutes: 10_080,
            usedPercent: 53,
            resetsAt: "2026-04-17T00:17:00Z",
          },
        },
      },
      "codex",
      now,
    );
    const [detailSvg] = extractSvgMarkup(buildProviderDetailMarkdown(detail, undefined, { now }));

    expect(detail.sections).toMatchObject([
      {
        kind: "usage",
        title: "Secondary",
        displayTitle: "Weekly",
        remainingPercent: 47,
        resetsIn: "11h 47m",
        usagePacing: {
          stage: "farUnder",
          actualUsedPercent: 53,
          lastsUntilReset: true,
          computedAt: "2026-04-16T12:30:00.000Z",
        },
      },
    ]);
    expect(detailSvg).toContain(">Weekly 47% left<");
    expect(detailSvg).toContain(">Resets in 11h 47m<");
    expect(detailSvg).toContain(">40% in reserve · Lasts until reset<");
  });

  it("omits zero-value countdown units", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "claude",
        sessionPercentLeft: 80,
        sessionResetsAt: "2026-03-23T11:00:00Z",
        weeklyPercentLeft: 55,
        weeklyResetsAt: "2026-03-28T10:30:00Z",
      },
      "claude",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(detail.sections[0]).toMatchObject({ resetsIn: "30m" });
    expect(detail.sections[1]).toMatchObject({ resetsIn: "5d" });
  });

  it("keeps sub-day countdowns in hours even when minute rounding reaches 24h", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "claude",
        sessionPercentLeft: 80,
        sessionResetsAt: "2026-03-24T10:29:01Z",
      },
      "claude",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(detail.sections[0]).toMatchObject({ resetsIn: "24h" });
  });

  it("switches to day formatting at an exact 24h boundary", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "claude",
        sessionPercentLeft: 80,
        sessionResetsAt: "2026-03-24T10:30:00Z",
      },
      "claude",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(detail.sections[0]).toMatchObject({ resetsIn: "1d" });
  });

  it("rounds up sub-hour countdowns to the next minute boundary", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "claude",
        sessionPercentLeft: 80,
        sessionResetsAt: "2026-03-23T11:29:01Z",
      },
      "claude",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(detail.sections[0]).toMatchObject({ resetsIn: "1h" });
  });

  it("keeps sparse payloads as minimal details instead of throwing", () => {
    const detail = normalizeProviderDetailPayload({ provider: "warp" }, "warp");

    expect(detail.id).toBe("warp");
    expect(detail.sections).toEqual([]);
    expect(buildProviderDetailMarkdown(detail)).toBe("No data available");
  });

  it("renders header-only details when account metadata exists without usage sections", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "vertexai",
        usage: {
          accountEmail: "dev@example.com",
          loginMethod: "gcloud",
        },
      },
      "vertexai",
    );
    const markdown = buildProviderDetailMarkdown(detail);
    const [detailSvg] = extractSvgMarkup(markdown);

    expect(detail.sections).toEqual([]);
    expect(detail.accountEmail).toBe("dev@example.com");
    expect(detail.planText).toBe("Gcloud");
    expect(markdown).toContain("data:image/svg+xml;base64,");
    expect(detailSvg).toContain(">Vertex AI<");
    expect(detailSvg).toContain(">dev@example.com<");
    expect(detailSvg).toContain(">Gcloud<");
  });

  it("prefers Claude subscription plan fields over generic oauth login methods", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "claude",
        loginMethod: "oauth",
        plan: "max",
      },
      "claude",
    );
    const [detailSvg] = extractSvgMarkup(buildProviderDetailMarkdown(detail));

    expect(detail.planText).toBe("Max");
    expect(detailSvg).toContain(">Max<");
    expect(detailSvg).not.toContain(">OAuth<");
    expect(
      normalizeProviderDetailPayload({ provider: "claude", loginMethod: "oauth", subscriptionType: "team" }, "claude")
        .planText,
    ).toBe("Team");
    expect(
      normalizeProviderDetailPayload({ provider: "claude", loginMethod: "oauth", rateLimitTier: "max_20x" }, "claude")
        .planText,
    ).toBe("Max 20x");
    expect(normalizeProviderDetailPayload({ provider: "claude", loginMethod: "oauth" }, "claude").planText).toBe(
      "OAuth",
    );
    expect(
      normalizeProviderDetailPayload(
        {
          provider: "claude",
          loginMethod: "oauth",
          plan: "pro",
          presentation: { schemaVersion: 1, meters: [] },
        },
        "claude",
      ).planText,
    ).toBe("Pro");
  });

  it("extracts provider-specific errors from CLI payload arrays", () => {
    const message = extractProviderErrorMessage(
      [
        { provider: "alibaba", error: { message: "No available fetch strategy for alibaba." } },
        { provider: "cli", error: { message: "Error" } },
      ],
      "alibaba",
    );

    expect(message).toBe("No available fetch strategy for alibaba.");
  });

  it("keeps resetsAt and windowMinutes from the source window", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const resetsAt = "2026-03-23T12:00:00Z";
    const windowMinutes = 300;

    const raw = normalizeProviderDetailPayload(
      { provider: "claude", usage: { primary: { usedPercent: 20, windowMinutes, resetsAt } } },
      "claude",
      now,
    );
    expect(raw.sections[0]).toMatchObject({
      kind: "usage",
      resetsIn: "1h 30m",
      resetsAt,
      windowMinutes,
    });

    const presentation = normalizeProviderDetailPayload(
      {
        provider: "claude",
        presentation: {
          schemaVersion: 1,
          meters: [{ kind: "primary", label: "Session", usedPercent: 20, windowMinutes, resetsAt }],
        },
      },
      "claude",
      now,
    );
    expect(presentation.sections[0]).toMatchObject({
      kind: "usage",
      resetsIn: "1h 30m",
      resetsAt,
      windowMinutes,
    });

    const extra = normalizeProviderDetailPayload(
      {
        provider: "claude",
        usage: {
          extraRateWindows: [{ id: "spark", title: "Spark", window: { usedPercent: 20, windowMinutes, resetsAt } }],
        },
      },
      "claude",
      now,
    );
    expect(extra.sections[0]).toMatchObject({
      kind: "supplementalUsage",
      resetsIn: "1h 30m",
      resetsAt,
      windowMinutes,
    });

    const bare = normalizeProviderDetailPayload(
      { provider: "claude", usage: { primary: { usedPercent: 20 } } },
      "claude",
      now,
    );
    expect(bare.sections[0]).not.toHaveProperty("resetsAt");
    expect(bare.sections[0]).not.toHaveProperty("windowMinutes");
  });

  it("renders named extra rate windows after the slot sections", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "codex",
        usage: {
          primary: { usedPercent: 40, resetsAt: "2026-03-23T12:00:00Z" },
          extraRateWindows: [
            {
              id: "codex-spark",
              title: "Codex Spark",
              window: { usedPercent: 25, resetsAt: "2026-03-23T15:30:00Z", nextRegenPercent: 5 },
            },
          ],
        },
      },
      "codex",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(detail.sections).toMatchObject([
      { kind: "usage", title: "Primary", remainingPercent: 60 },
      {
        kind: "supplementalUsage",
        title: "Codex Spark",
        remainingPercent: 75,
        resetsIn: "5h",
        nextRegenPercent: 5,
      },
    ]);
    expect(detail.sections[0]).not.toHaveProperty("includeInDetail", false);
  });

  it("hides antigravity Primary and Secondary when quota-summary extras are present", () => {
    const now = Date.parse("2026-08-26T20:36:23Z");
    const weeklyReset = "2026-09-02T20:36:23Z";
    const detail = normalizeProviderDetailPayload(
      {
        provider: "antigravity",
        usage: {
          primary: { usedPercent: 0, windowMinutes: 10_080, resetsAt: weeklyReset },
          secondary: { usedPercent: 0, windowMinutes: 10_080, resetsAt: weeklyReset },
          extraRateWindows: [
            {
              id: "antigravity-quota-summary-gemini-weekly",
              title: "Gemini weekly",
              window: { usedPercent: 0, windowMinutes: 10_080, resetsAt: weeklyReset },
            },
            {
              id: "antigravity-quota-summary-3p-weekly",
              title: "Claude/GPT weekly",
              window: { usedPercent: 0, windowMinutes: 10_080, resetsAt: weeklyReset },
            },
          ],
        },
      },
      "antigravity",
      now,
    );

    expect(detail.sections).toMatchObject([
      {
        kind: "usage",
        title: "Primary",
        displayTitle: "Gemini Models",
        remainingPercent: 100,
        includeInDetail: false,
        resetsIn: "7d",
      },
      {
        kind: "usage",
        title: "Secondary",
        displayTitle: "Claude and GPT",
        remainingPercent: 100,
        includeInDetail: false,
        resetsIn: "7d",
      },
      { kind: "supplementalUsage", title: "Gemini weekly", remainingPercent: 100, resetsIn: "7d" },
      { kind: "supplementalUsage", title: "Claude/GPT weekly", remainingPercent: 100, resetsIn: "7d" },
    ]);
  });

  it("leaves antigravity Primary and Secondary visible without quota-summary extras", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "antigravity",
        usage: {
          primary: { usedPercent: 12, windowMinutes: 300 },
          secondary: { usedPercent: 34, windowMinutes: 10_080 },
        },
      },
      "antigravity",
    );

    expect(detail.sections).toMatchObject([
      { kind: "usage", title: "Primary", displayTitle: "Gemini Models", remainingPercent: 88 },
      { kind: "usage", title: "Secondary", displayTitle: "Claude and GPT", remainingPercent: 66 },
    ]);
    expect(detail.sections[0]).not.toHaveProperty("includeInDetail", false);
    expect(detail.sections[1]).not.toHaveProperty("includeInDetail", false);
  });

  it("does not rewrite antigravity presentation meters when quota-summary extras exist", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "antigravity",
        presentation: {
          schemaVersion: 1,
          meters: [
            {
              id: "extra:gemini-weekly",
              kind: "supplemental",
              label: "Gemini weekly",
              usedPercent: 0,
              remainingPercent: 100,
              windowMinutes: 10_080,
              resetsAt: "2026-09-02T20:36:23Z",
            },
          ],
        },
        usage: {
          primary: { usedPercent: 99 },
          extraRateWindows: [
            {
              id: "antigravity-quota-summary-gemini-weekly",
              title: "Gemini weekly",
              window: { usedPercent: 0 },
            },
          ],
        },
      },
      "antigravity",
      Date.parse("2026-08-26T20:36:23Z"),
    );

    expect(detail.sections).toMatchObject([
      { kind: "supplementalUsage", title: "Gemini weekly", remainingPercent: 100 },
    ]);
    expect(detail.sections).toHaveLength(1);
  });

  it("passes nextRegenPercent through slot windows and renders the regen footer", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const detail = normalizeProviderDetailPayload(
      {
        provider: "claude",
        usage: {
          primary: { usedPercent: 30, resetsAt: "2026-03-23T12:00:00Z", nextRegenPercent: 4 },
        },
      },
      "claude",
      now,
    );
    const [detailSvg] = extractSvgMarkup(buildProviderDetailMarkdown(detail, undefined, { now }));

    expect(detail.sections[0]).toMatchObject({ kind: "usage", nextRegenPercent: 4 });
    expect(detailSvg).toContain(">Regenerates 4% next tick<");
  });

  it("maps openRouterUsage into supplemental and info sections", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "openrouter",
        usage: {
          openRouterUsage: {
            usedPercent: 49,
            balance: 25.5,
            keyUsage: 47,
            keyLimit: 100,
          },
        },
      },
      "openrouter",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(detail.sections).toMatchObject([
      { kind: "supplementalUsage", title: "Credits used", remainingPercent: 51 },
      {
        kind: "info",
        title: "OpenRouter",
        items: [
          { label: "Balance", value: "$25.50" },
          { label: "Key usage", value: "$47 / $100" },
        ],
      },
    ]);
  });

  it("filters unavailable and expired Codex reset credits", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "codex",
        usage: {
          codexResetCredits: {
            credits: [
              {
                status: "available",
                reset_type: "weekly",
                granted_at: "2026-03-22T10:30:00Z",
                expires_at: "2026-03-24T10:30:00Z",
              },
              {
                status: "redeemed",
                reset_type: "weekly",
                granted_at: "2026-03-22T10:30:00Z",
                expires_at: "2026-03-25T10:30:00Z",
              },
              {
                status: "available",
                reset_type: "weekly",
                granted_at: "2026-03-22T10:30:00Z",
                expires_at: "2026-03-23T10:29:00Z",
              },
              {
                status: "unknown",
                reset_type: "weekly",
                granted_at: "2026-03-22T10:30:00Z",
                expires_at: "2026-03-26T10:30:00Z",
              },
            ],
          },
        },
      },
      "codex",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(detail.sections).toContainEqual({
      kind: "info",
      title: "Limit Reset Credits",
      usageItemId: "section:codex-reset-credits",
      items: [
        { label: "Available", value: "1 available" },
        { label: "Next expiry", value: "1d" },
      ],
    });
  });

  it("sorts Codex reset credits by expiry with no-expiry credits last", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "codex",
        usage: {
          codexResetCredits: {
            credits: [
              { status: "available" },
              { status: "available", expires_at: "2026-03-25T10:30:00Z" },
              { status: "available", expires_at: "2026-03-24T10:30:00Z" },
            ],
          },
        },
      },
      "codex",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(detail.sections).toContainEqual({
      kind: "info",
      title: "Limit Reset Credits",
      usageItemId: "section:codex-reset-credits",
      items: [
        { label: "Available", value: "3 available" },
        { label: "Next expiry", value: "1d" },
        { label: "Expiries", value: "1d, 2d, No expiry" },
      ],
    });
  });

  it("renders no Codex reset credit section when inventory is empty or non-Codex", () => {
    const emptyCodex = normalizeProviderDetailPayload(
      {
        provider: "codex",
        usage: {
          codexResetCredits: {
            credits: [
              { status: "redeemed", expires_at: "2026-03-24T10:30:00Z" },
              { status: "available", expires_at: "2026-03-23T10:29:00Z" },
            ],
          },
        },
      },
      "codex",
      Date.parse("2026-03-23T10:30:00Z"),
    );
    const claudeWithCredits = normalizeProviderDetailPayload(
      {
        provider: "claude",
        usage: {
          codexResetCredits: {
            credits: [{ status: "available", expires_at: "2026-03-24T10:30:00Z" }],
          },
        },
      },
      "claude",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(emptyCodex.sections.some((section) => section.title === "Limit Reset Credits")).toBe(false);
    expect(claudeWithCredits.sections.some((section) => section.title === "Limit Reset Credits")).toBe(false);
  });

  it("does not render Codex code review for another provider", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "claude",
        openaiDashboard: { codeReviewRemainingPercent: 40 },
      },
      "claude",
      Date.parse("2026-03-23T10:30:00Z"),
    );

    expect(detail.sections.some((section) => section.title === "Code review")).toBe(false);
  });

  it("renders Codex reset credit info in the detail markdown", () => {
    const now = Date.parse("2026-03-23T10:30:00Z");
    const detail = normalizeProviderDetailPayload(
      {
        provider: "codex",
        usage: {
          primary: { usedPercent: 40 },
          codexResetCredits: {
            credits: [{ status: "available", expires_at: "2026-03-24T10:30:00Z" }],
          },
        },
      },
      "codex",
      now,
    );
    const [detailSvg] = extractSvgMarkup(buildProviderDetailMarkdown(detail, undefined, { now }));

    expect(detailSvg).toContain(">Limit Reset Credits<");
    expect(detailSvg).toContain(">Available<");
    expect(detailSvg).toContain(">1 available<");
    expect(detailSvg).toContain(">Next expiry<");
    expect(detailSvg).toContain(">1d<");
  });
});

describe("Codex weekly caps session (raw path)", () => {
  // Mirrors CodexConsumerProjectionTests: exhausted weekly is the binding cap.
  const NOW = Date.parse("2026-03-23T10:30:00Z");
  const SESSION_RESETS_AT = "2026-03-23T13:30:00Z"; // 3h out
  const WEEKLY_RESETS_AT = "2026-03-27T10:30:00Z"; // 4d out
  const WEEKLY_RESET_PAST = "2026-03-23T09:00:00Z";

  function sections(provider: string, usage: Record<string, unknown>, presentation?: Record<string, unknown>) {
    return normalizeProviderDetailPayload({ provider, usage, ...(presentation ? { presentation } : {}) }, provider, NOW)
      .sections;
  }

  it("caps Primary to 0% and retargets reset to weekly when weekly is exhausted with a future reset", () => {
    const result = sections("codex", {
      primary: { windowMinutes: 300, usedPercent: 1, resetsAt: SESSION_RESETS_AT },
      secondary: { windowMinutes: 10_080, usedPercent: 157, resetsAt: WEEKLY_RESETS_AT },
    });

    expect(result).toMatchObject([
      {
        kind: "usage",
        title: "Primary",
        remainingPercent: 0,
        resetsIn: "4d",
      },
      {
        kind: "usage",
        title: "Secondary",
        remainingPercent: 0,
        resetsIn: "4d",
      },
    ]);
    expect(result[0].kind === "usage" && result[0].usagePacing).toBeUndefined();
  });

  it("still caps session when weekly is exhausted with no resetsAt", () => {
    const result = sections("codex", {
      primary: { windowMinutes: 300, usedPercent: 1, resetsAt: SESSION_RESETS_AT },
      secondary: { windowMinutes: 10_080, usedPercent: 100 },
    });

    expect(result[0]).toMatchObject({
      kind: "usage",
      title: "Primary",
      remainingPercent: 0,
    });
    expect(result[0].kind === "usage" ? result[0].resetsIn : undefined).toBeUndefined();
  });

  it("does not cap session when the weekly reset is already past", () => {
    const result = sections("codex", {
      primary: { windowMinutes: 300, usedPercent: 1, resetsAt: SESSION_RESETS_AT },
      secondary: { windowMinutes: 10_080, usedPercent: 100, resetsAt: WEEKLY_RESET_PAST },
    });

    expect(result[0]).toMatchObject({
      kind: "usage",
      title: "Primary",
      remainingPercent: 99,
      resetsIn: "3h",
    });
  });

  it("leaves session unchanged when weekly still has remaining", () => {
    const result = sections("codex", {
      primary: { windowMinutes: 300, usedPercent: 1, resetsAt: SESSION_RESETS_AT },
      secondary: { windowMinutes: 10_080, usedPercent: 12, resetsAt: WEEKLY_RESETS_AT },
    });

    expect(result[0]).toMatchObject({
      kind: "usage",
      title: "Primary",
      remainingPercent: 99,
      resetsIn: "3h",
    });
  });

  it("does not apply the cap to non-codex providers with the same numbers", () => {
    const result = sections("claude", {
      primary: { windowMinutes: 300, usedPercent: 1, resetsAt: SESSION_RESETS_AT },
      secondary: { windowMinutes: 10_080, usedPercent: 157, resetsAt: WEEKLY_RESETS_AT },
    });

    expect(result[0]).toMatchObject({
      kind: "usage",
      title: "Primary",
      remainingPercent: 99,
      resetsIn: "3h",
    });
  });

  it("does not re-apply the cap when presentation meters are authoritative", () => {
    const result = sections(
      "codex",
      {
        primary: { windowMinutes: 300, usedPercent: 1, resetsAt: SESSION_RESETS_AT },
        secondary: { windowMinutes: 10_080, usedPercent: 157, resetsAt: WEEKLY_RESETS_AT },
      },
      {
        schemaVersion: 1,
        meters: [
          {
            id: "primary",
            kind: "primary",
            label: "Session",
            usedPercent: 1,
            remainingPercent: 99,
            windowMinutes: 300,
            resetsAt: SESSION_RESETS_AT,
          },
          {
            id: "secondary",
            kind: "secondary",
            label: "Weekly",
            usedPercent: 100,
            remainingPercent: 0,
            windowMinutes: 10_080,
            resetsAt: WEEKLY_RESETS_AT,
          },
        ],
      },
    );

    expect(result).toMatchObject([
      { kind: "usage", title: "Primary", remainingPercent: 99, resetsIn: "3h" },
      { kind: "usage", title: "Secondary", remainingPercent: 0, resetsIn: "4d" },
    ]);
  });

  it("does not re-apply the cap when schema 2 meters are authoritative", () => {
    const result = sections(
      "codex",
      {
        primary: { windowMinutes: 300, usedPercent: 1, resetsAt: SESSION_RESETS_AT },
        secondary: { windowMinutes: 10_080, usedPercent: 157, resetsAt: WEEKLY_RESETS_AT },
      },
      {
        schemaVersion: 2,
        meters: [
          {
            id: "primary",
            kind: "primary",
            label: "Session",
            usedPercent: 1,
            remainingPercent: 99,
            windowMinutes: 300,
            resetsAt: SESSION_RESETS_AT,
            resetText: "Resets in 3h",
          },
          {
            id: "secondary",
            kind: "secondary",
            label: "Weekly",
            usedPercent: 100,
            remainingPercent: 0,
            windowMinutes: 10_080,
            resetsAt: WEEKLY_RESETS_AT,
          },
        ],
      },
    );

    expect(result[0]).toMatchObject({
      kind: "usage",
      title: "Primary",
      remainingPercent: 99,
      resetText: "Resets in 3h",
    });
    expect(result[0]).not.toHaveProperty("resetsIn");
    expect(result[1]).toMatchObject({ kind: "usage", title: "Secondary", remainingPercent: 0 });
    expect(result[1]).not.toHaveProperty("resetsIn");
    expect(result[0]).not.toHaveProperty("usagePacing");
  });

  it("when both lanes are exhausted, retargets Primary reset to the later of the two", () => {
    const sessionLater = "2026-03-23T14:30:00Z"; // 4h out
    const weeklySooner = "2026-03-23T11:30:00Z"; // 1h out
    const result = sections("codex", {
      primary: { windowMinutes: 300, usedPercent: 100, resetsAt: sessionLater },
      secondary: { windowMinutes: 10_080, usedPercent: 100, resetsAt: weeklySooner },
    });

    expect(result[0]).toMatchObject({
      kind: "usage",
      title: "Primary",
      remainingPercent: 0,
      resetsIn: "4h",
    });
  });
});

describe("usage pacing gating", () => {
  const NOW = Date.parse("2026-03-23T10:30:00Z");
  // Session window resets 2.5h out (inside the 5h session cadence).
  const SESSION_RESETS_AT = "2026-03-23T13:00:00Z";
  // Weekly window resets 5d out (inside the 7d weekly cadence).
  const WEEKLY_RESETS_AT = "2026-03-28T10:30:00Z";

  function pace(provider: string, usage: Record<string, unknown>) {
    return normalizeProviderDetailPayload({ provider, usage }, provider, NOW).sections;
  }

  function usagePacing(section: ProviderSection | undefined): ProviderUsagePacing | undefined {
    return section && section.kind !== "info" ? section.usagePacing : undefined;
  }

  it("paces the codex/claude session window with the 300-min default when windowMinutes is absent", () => {
    for (const provider of ["codex", "claude"] as const) {
      const [primary] = pace(provider, { primary: { usedPercent: 60, resetsAt: SESSION_RESETS_AT } });
      expect(primary, provider).toMatchObject({
        title: "Primary",
        usagePacing: { stage: "over", context: "session" },
      });
    }
  });

  it("only paces the ollama session window when the payload carries an explicit windowMinutes", () => {
    const [withoutWindow] = pace("ollama", { primary: { usedPercent: 60, resetsAt: SESSION_RESETS_AT } });
    expect(usagePacing(withoutWindow)).toBeUndefined();

    const [withWindow] = pace("ollama", {
      primary: { windowMinutes: 300, usedPercent: 60, resetsAt: SESSION_RESETS_AT },
    });
    expect(usagePacing(withWindow)).toMatchObject({ context: "session" });
  });

  it("paces the antigravity session window only when windowMinutes is exactly 300", () => {
    const [withoutWindow] = pace("antigravity", { primary: { usedPercent: 60, resetsAt: SESSION_RESETS_AT } });
    expect(usagePacing(withoutWindow)).toBeUndefined();

    const [withSessionWindow] = pace("antigravity", {
      primary: { windowMinutes: 300, usedPercent: 60, resetsAt: SESSION_RESETS_AT },
    });
    expect(usagePacing(withSessionWindow)).toMatchObject({ stage: "over", context: "session" });
  });

  it("does not pace the antigravity session window when windowMinutes is present and not 300", () => {
    const [primary] = pace("antigravity", {
      primary: { windowMinutes: 10_080, usedPercent: 60, resetsAt: SESSION_RESETS_AT },
    });
    expect(usagePacing(primary)).toBeUndefined();
  });

  it("does not session-pace a factory 5-hour primary", () => {
    const [primary] = pace("factory", {
      primary: { windowMinutes: 300, usedPercent: 60, resetsAt: SESSION_RESETS_AT },
    });
    expect(usagePacing(primary)).toBeUndefined();
  });

  it("does not session-pace a Codex primary that is a 7-day or 30-day window", () => {
    const [weekly] = pace("codex", {
      primary: { windowMinutes: 10_080, usedPercent: 50, resetsAt: WEEKLY_RESETS_AT },
    });
    expect(usagePacing(weekly)).toBeUndefined();

    const [monthly] = pace("codex", {
      primary: { windowMinutes: 43_200, usedPercent: 50, resetsAt: "2026-04-12T10:30:00Z" },
    });
    expect(usagePacing(monthly)).toBeUndefined();
  });

  it("does not session-pace OpenCode Go's 5-hour primary", () => {
    const [primary] = pace("opencodego", {
      primary: { windowMinutes: 300, usedPercent: 60, resetsAt: SESSION_RESETS_AT },
    });
    expect(usagePacing(primary)).toBeUndefined();
  });

  it("does not pace OpenCode Go estimated snapshots", () => {
    const monthly = { windowMinutes: 43_200, usedPercent: 50, resetsAt: "2026-04-22T10:30:00Z" };
    const [estimated] = normalizeProviderDetailPayload(
      { provider: "opencodego", usage: { primary: monthly, dataConfidence: "estimated" } },
      "opencodego",
      NOW,
    ).sections;
    expect(usagePacing(estimated)).toBeUndefined();

    const [exact] = pace("opencodego", { primary: monthly, dataConfidence: "exact" });
    expect(usagePacing(exact)).toMatchObject({ context: "window" });
  });

  it("paces the codex secondary window with the 10080-min default when windowMinutes is absent", () => {
    const [secondary] = pace("codex", { secondary: { usedPercent: 50, resetsAt: WEEKLY_RESETS_AT } });
    expect(secondary).toMatchObject({
      title: "Secondary",
      usagePacing: { stage: "farOver", context: "window" },
    });
  });

  it("does not extend the codex default-window fallback to the tertiary slot", () => {
    const [tertiary] = pace("codex", { tertiary: { usedPercent: 50, resetsAt: WEEKLY_RESETS_AT } });
    expect(usagePacing(tertiary)).toBeUndefined();
  });

  it("only paces a generic provider's weekly window when windowMinutes is explicit", () => {
    const [withoutWindow] = pace("factory", { secondary: { usedPercent: 50, resetsAt: WEEKLY_RESETS_AT } });
    expect(usagePacing(withoutWindow)).toBeUndefined();

    const [withWindow] = pace("factory", {
      secondary: { windowMinutes: 10_080, usedPercent: 50, resetsAt: WEEKLY_RESETS_AT },
    });
    expect(usagePacing(withWindow)).toMatchObject({ context: "window" });
  });

  it("paces cursor billing-cycle windows that carry windowMinutes, including primary", () => {
    const [primary] = pace("cursor", {
      primary: { windowMinutes: 10_080, usedPercent: 50, resetsAt: WEEKLY_RESETS_AT },
    });
    expect(usagePacing(primary)).toMatchObject({ context: "window" });

    const [untyped] = pace("cursor", { primary: { usedPercent: 50, resetsAt: WEEKLY_RESETS_AT } });
    expect(usagePacing(untyped)).toBeUndefined();

    const [secondary] = pace("cursor", {
      secondary: { windowMinutes: 10_080, usedPercent: 50, resetsAt: WEEKLY_RESETS_AT },
    });
    expect(usagePacing(secondary)).toMatchObject({ context: "window" });
  });

  it("paces grok's primary weekly credits window as a reset-window pacer, not session pace", () => {
    const [primary] = pace("grok", {
      primary: { windowMinutes: 10_080, usedPercent: 50, resetsAt: WEEKLY_RESETS_AT },
    });
    expect(primary).toMatchObject({
      title: "Primary",
      displayTitle: "Weekly",
      usagePacing: { context: "window" },
    });
  });

  it("paces grok's untyped weekly credits window with the 10080-min default", () => {
    const [primary] = pace("grok", { primary: { usedPercent: 50, resetsAt: WEEKLY_RESETS_AT } });
    expect(primary).toMatchObject({
      displayTitle: "Weekly",
      usagePacing: { context: "window" },
    });
  });

  it("does not pace grok's monthly or short primary windows", () => {
    const [monthly] = pace("grok", { primary: { usedPercent: 50, resetsAt: "2026-04-22T10:30:00Z" } });
    expect(monthly).toMatchObject({ displayTitle: "Monthly" });
    expect(usagePacing(monthly)).toBeUndefined();

    const [short] = pace("grok", {
      primary: { windowMinutes: 300, usedPercent: 60, resetsAt: SESSION_RESETS_AT },
    });
    expect(short).toMatchObject({ displayTitle: "Credits" });
    expect(usagePacing(short)).toBeUndefined();
  });

  it("does not treat grok's Weekly display-label fallback as pace eligibility", () => {
    const [primary] = pace("grok", { primary: { usedPercent: 50, resetsAt: "2026-03-25T10:30:00Z" } });
    expect(primary).toMatchObject({ displayTitle: "Weekly" });
    expect(usagePacing(primary)).toBeUndefined();
  });

  it("paces grok's secondary window when that window itself is Weekly-shaped", () => {
    const [short] = pace("grok", { secondary: { usedPercent: 50, resetsAt: SESSION_RESETS_AT } });
    expect(usagePacing(short)).toBeUndefined();

    const [weekly] = pace("grok", { secondary: { usedPercent: 50, resetsAt: WEEKLY_RESETS_AT } });
    expect(usagePacing(weekly)).toMatchObject({ context: "window" });
  });

  it("paces copilot primary from resetsAt by inferring the calendar month", () => {
    const [primary] = pace("copilot", { primary: { usedPercent: 50, resetsAt: "2026-04-01T00:00:00Z" } });
    expect(usagePacing(primary)).toMatchObject({ context: "window" });
  });

  it("paces kimi's 7-day primary as a window and the 5-hour secondary as a session", () => {
    const [primary] = pace("kimi", {
      primary: { windowMinutes: 10_080, usedPercent: 50, resetsAt: WEEKLY_RESETS_AT },
    });
    expect(usagePacing(primary)).toMatchObject({ context: "window" });

    const [secondary] = pace("kimi", {
      secondary: { windowMinutes: 300, usedPercent: 60, resetsAt: SESSION_RESETS_AT },
    });
    expect(usagePacing(secondary)).toMatchObject({ context: "session" });
  });

  it("paces zai's 5-hour primary as a session and a sole MCP primary as a window", () => {
    const [primary] = pace("zai", {
      primary: { windowMinutes: 300, usedPercent: 60, resetsAt: SESSION_RESETS_AT },
    });
    expect(usagePacing(primary)).toMatchObject({ context: "session" });

    const [other] = pace("zai", {
      primary: { windowMinutes: 10_080, usedPercent: 50, resetsAt: WEEKLY_RESETS_AT },
    });
    expect(usagePacing(other)).toBeUndefined();

    const [mcp] = pace("zai", {
      primary: {
        windowMinutes: 43_200,
        usedPercent: 40,
        resetsAt: "2026-04-22T10:30:00Z",
        resetDescription: "MCP",
      },
    });
    expect(usagePacing(mcp)).toMatchObject({ context: "window" });
  });

  it("paces notion rolling session windows of at most 6 hours", () => {
    const [rolling] = pace("notion", {
      primary: { windowMinutes: 360, usedPercent: 60, resetsAt: SESSION_RESETS_AT },
    });
    expect(usagePacing(rolling)).toMatchObject({ context: "session" });

    const [tooLong] = pace("notion", {
      primary: { windowMinutes: 600, usedPercent: 60, resetsAt: SESSION_RESETS_AT },
    });
    expect(usagePacing(tooLong)).toBeUndefined();
  });

  it("re-scores a 30-day sentinel as the real calendar month", () => {
    const reset = "2026-04-22T10:30:00Z";
    const [alibaba] = pace("alibaba", { tertiary: { windowMinutes: 43_200, usedPercent: 20, resetsAt: reset } });
    expect(usagePacing(alibaba)).toMatchObject({ context: "window" });

    const [factoryMidWindow] = pace("factory", {
      tertiary: { windowMinutes: 43_200, usedPercent: 20, resetsAt: "2026-04-12T10:30:00Z" },
    });
    expect(usagePacing(factoryMidWindow)).toBeUndefined();
  });

  it("paces grok presentation meters with the same weekly reset-window rule", () => {
    const [primary] = normalizeProviderDetailPayload(
      {
        provider: "grok",
        presentation: {
          schemaVersion: 1,
          meters: [
            {
              kind: "primary",
              label: "Weekly",
              usedPercent: 50,
              remainingPercent: 50,
              windowMinutes: 10_080,
              resetsAt: WEEKLY_RESETS_AT,
            },
          ],
        },
      },
      "grok",
      NOW,
    ).sections;
    expect(usagePacing(primary)).toMatchObject({ context: "window" });
  });

  it("paces Codex, Claude, Antigravity, and Cursor extras the way the menu card does", () => {
    const extra = (provider: string, windowMinutes: number) =>
      usagePacing(
        pace(provider, {
          primary: { usedPercent: 40, resetsAt: SESSION_RESETS_AT },
          extraRateWindows: [
            {
              id: "extra",
              title: "Extra",
              window: {
                windowMinutes,
                usedPercent: 60,
                resetsAt: windowMinutes === 300 ? SESSION_RESETS_AT : WEEKLY_RESETS_AT,
              },
            },
          ],
        }).find((section) => section.title === "Extra"),
      );

    expect(extra("codex", 300)).toMatchObject({ context: "session" });
    expect(extra("codex", 10_080)).toMatchObject({ context: "window" });
    expect(extra("antigravity", 300)).toMatchObject({ context: "session" });
    expect(extra("claude", 10_080)).toMatchObject({ context: "window" });
    expect(extra("claude", 300)).toBeUndefined();
    expect(extra("cursor", 10_080)).toMatchObject({ context: "window" });
    expect(extra("cursor", 300)).toBeUndefined();
    expect(extra("factory", 10_080)).toBeUndefined();
    expect(extra("zai", 43_200)).toBeUndefined();
  });

  it("paces presentation supplemental meters with the same extra-window rule", () => {
    const [spark] = normalizeProviderDetailPayload(
      {
        provider: "codex",
        presentation: {
          schemaVersion: 1,
          meters: [
            {
              kind: "supplemental",
              label: "Codex Spark",
              usedPercent: 60,
              remainingPercent: 40,
              windowMinutes: 300,
              resetsAt: SESSION_RESETS_AT,
            },
          ],
        },
      },
      "codex",
      NOW,
    ).sections;
    expect(usagePacing(spark)).toMatchObject({ context: "session" });
  });
});

describe("menu card detail", () => {
  const now = Date.parse("2026-03-23T10:30:00Z");
  const resetsAt = "2026-04-17T14:30:00Z";
  const copilotResetsAt = "2026-04-01T00:00:00Z";
  const balance = "336.73 / 500 credits left";

  function usageSection(detail: { sections: ProviderSection[] }, title: "Primary" | "Secondary" | "Tertiary") {
    return detail.sections.find(
      (section): section is ProviderUsageSection => section.kind === "usage" && section.title === title,
    );
  }

  function cardSvg(detail: { id: string; name: string; sections: ProviderSection[] }) {
    const [svg] = extractSvgMarkup(buildProviderDetailMarkdown(detail, "light"));
    return svg;
  }

  it("keeps the Raycast countdown and copies resetDescription to detailText", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "raycast",
        usage: { primary: { usedPercent: 33, resetsAt, resetDescription: `  ${balance}  ` } },
      },
      "raycast",
      now,
    );
    expect(usageSection(detail, "Primary")).toMatchObject({
      resetsIn: "25d 4h",
      detailText: balance,
    });
    expect(usageSection(detail, "Primary")).not.toHaveProperty("detailLeftText");
    expect(usageSection(detail, "Primary")).not.toHaveProperty("replacesPace");
  });

  it("copies detailText from a schema 1 meter", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "raycast",
        presentation: {
          schemaVersion: 1,
          meters: [
            {
              kind: "primary",
              label: "Credits",
              usedPercent: 33,
              remainingPercent: 67,
              resetsAt,
              resetDescription: balance,
            },
          ],
        },
      },
      "raycast",
      now,
    );
    expect(detail.sections[0]).toMatchObject({
      kind: "usage",
      resetsIn: "25d 4h",
      detailText: balance,
    });
  });

  it("keeps Copilot primary detailLeftText and lets pacing replace it on the card", () => {
    const paced = normalizeProviderDetailPayload(
      {
        provider: "copilot",
        usage: { primary: { usedPercent: 50, resetsAt: copilotResetsAt, resetDescription: "Included" } },
      },
      "copilot",
      now,
    );
    const primary = usageSection(paced, "Primary");
    expect(primary).toMatchObject({ detailLeftText: "Included" });
    expect(primary).not.toHaveProperty("replacesPace");
    expect(primary?.usagePacing).toBeDefined();
    const pacedSvg = cardSvg(paced);
    expect(pacedSvg).toContain(`>${formatUsagePacingLine(primary!.usagePacing!)}<`);
    expect(pacedSvg).not.toContain(">Included<");

    const plain = normalizeProviderDetailPayload(
      { provider: "copilot", usage: { primary: { usedPercent: 10, resetDescription: "Included" } } },
      "copilot",
      now,
    );
    expect(usageSection(plain, "Primary")).toMatchObject({ detailLeftText: "Included" });
    expect(usageSection(plain, "Primary")?.usagePacing).toBeUndefined();
    const plainSvg = cardSvg(plain);
    expect(plainSvg).toContain(">Included<");
    expect(plainSvg).not.toContain("in reserve");
    expect(plainSvg).not.toContain("in deficit");
  });

  it("sets replacesPace on Copilot secondary and draws the description unless the forecast is a reset window", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "copilot",
        usage: { secondary: { usedPercent: 50, resetsAt: copilotResetsAt, resetDescription: "115% used" } },
      },
      "copilot",
      now,
    );
    const secondary = usageSection(detail, "Secondary");
    expect(secondary).toMatchObject({ detailLeftText: "115% used", replacesPace: true });
    expect(secondary?.usagePacing).toBeDefined();
    const pacedSvg = cardSvg(detail);
    expect(pacedSvg).toContain(`>${formatUsagePacingLine(secondary!.usagePacing!)}<`);
    expect(pacedSvg).not.toContain(">115% used<");
    expect(rectsWithSize(parseSvg(pacedSvg), 3, 12)).toHaveLength(1);

    const ordinary = {
      ...detail,
      sections: detail.sections.map((section) =>
        section.kind === "usage" && section.title === "Secondary" ? { ...section, resetsAt: undefined } : section,
      ),
    };
    const ordinarySvg = cardSvg(ordinary);
    expect(ordinarySvg).toContain(">115% used<");
    expect(ordinarySvg).not.toContain("in reserve");
    expect(ordinarySvg).not.toContain("in deficit");
    expect(ordinarySvg).not.toContain(">On pace<");
    expect(rectsWithSize(parseSvg(ordinarySvg), 3, 12)).toEqual([]);
  });

  it("draws Zenmux secondary description instead of an ordinary weekly pace line", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "zenmux",
        usage: {
          secondary: {
            usedPercent: 50,
            windowMinutes: 10_080,
            resetsAt: "2026-03-28T10:30:00Z",
            resetDescription: "4 days left",
          },
        },
      },
      "zenmux",
      now,
    );
    const secondary = usageSection(detail, "Secondary");
    expect(secondary).toMatchObject({
      detailLeftText: "4 days left",
      replacesPace: true,
      resetsIn: "5d",
    });
    expect(secondary?.usagePacing).toBeDefined();
    const svg = cardSvg(detail);
    expect(svg).toContain(">4 days left<");
    expect(svg).not.toContain(formatUsagePacingLine(secondary!.usagePacing!));
    expect(rectsWithSize(parseSvg(svg), 3, 12)).toEqual([]);

    const undated = normalizeProviderDetailPayload(
      { provider: "zenmux", usage: { secondary: { usedPercent: 50, resetDescription: "Weekly quota" } } },
      "zenmux",
      now,
    );
    expect(usageSection(undated, "Secondary")).toMatchObject({ detailLeftText: "Weekly quota", replacesPace: true });
    expect(usageSection(undated, "Secondary")).not.toHaveProperty("resetsIn");
    expect(usageSection(undated, "Secondary")).not.toHaveProperty("resetText");
  });

  it("formats Kiro credits, skips a zero total, and lets bonus credits replace pacing", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "kiro",
        usage: {
          primary: { usedPercent: 10 },
          secondary: { usedPercent: 20, windowMinutes: 10_080, resetsAt: "2026-03-28T10:30:00Z" },
          details: [
            {
              rows: [
                { label: "Credits left", value: "120" },
                { label: "Credits total", value: "500" },
                { label: "Bonus credits left", value: "40", secondaryValue: "of 100 · expires in 3d" },
              ],
            },
          ],
        },
      },
      "kiro",
      now,
    );
    expect(usageSection(detail, "Primary")).toMatchObject({ detailLeftText: "120 of 500 credits left" });
    expect(usageSection(detail, "Primary")).not.toHaveProperty("detailText");
    const bonus = usageSection(detail, "Secondary");
    expect(bonus).toMatchObject({ detailLeftText: "40 of 100 bonus credits left", replacesPace: true });
    expect(bonus?.usagePacing).toBeDefined();
    const svg = cardSvg(detail);
    expect(svg).toContain(">40 of 100 bonus credits left<");
    expect(svg).not.toContain(formatUsagePacingLine(bonus!.usagePacing!));
    expect(rectsWithSize(parseSvg(svg), 3, 12)).toEqual([]);

    const zero = normalizeProviderDetailPayload(
      {
        provider: "kiro",
        usage: {
          primary: { usedPercent: 10 },
          secondary: { usedPercent: 20 },
          details: [
            {
              rows: [
                { label: "Credits left", value: "0" },
                { label: "Credits total", value: "0" },
                { label: "Bonus credits left", value: "40" },
              ],
            },
          ],
        },
      },
      "kiro",
      now,
    );
    expect(usageSection(zero, "Primary")).not.toHaveProperty("detailLeftText");
    expect(usageSection(zero, "Secondary")).not.toHaveProperty("detailLeftText");
    expect(usageSection(zero, "Secondary")).not.toHaveProperty("replacesPace");
  });

  it("copies an Alibaba tertiary resetDescription to detailText", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "alibaba",
        usage: { tertiary: { usedPercent: 10, resetDescription: "3,000 / 10,000 left" } },
      },
      "alibaba",
      now,
    );
    expect(usageSection(detail, "Tertiary")).toMatchObject({ detailText: "3,000 / 10,000 left" });
    expect(usageSection(detail, "Tertiary")).not.toHaveProperty("detailLeftText");
    expect(usageSection(detail, "Tertiary")).not.toHaveProperty("replacesPace");
  });

  it("uses OpenRouter's reset placement only when the window has no countdown", () => {
    const withoutDate = normalizeProviderDetailPayload(
      { provider: "openrouter", usage: { primary: { usedPercent: 10, resetDescription: "monthly" } } },
      "openrouter",
      now,
    );
    expect(usageSection(withoutDate, "Primary")).toMatchObject({ resetText: "monthly" });
    expect(usageSection(withoutDate, "Primary")).not.toHaveProperty("detailText");
    expect(usageSection(withoutDate, "Primary")?.resetsIn).toBeUndefined();

    const withDate = normalizeProviderDetailPayload(
      {
        provider: "openrouter",
        usage: { primary: { usedPercent: 10, resetsAt, resetDescription: "monthly" } },
      },
      "openrouter",
      now,
    );
    expect(usageSection(withDate, "Primary")).toMatchObject({ resetsIn: "25d 4h" });
    expect(usageSection(withDate, "Primary")).not.toHaveProperty("resetText");
    expect(usageSection(withDate, "Primary")).not.toHaveProperty("detailText");
  });

  it("reads the Poe balance after the Balance prefix", () => {
    const detail = normalizeProviderDetailPayload(
      { provider: "poe", usage: { primary: { usedPercent: 10 }, loginMethod: "Balance: 1.2k points" } },
      "poe",
      now,
    );
    expect(usageSection(detail, "Primary")).toMatchObject({ detailText: "1.2k points" });

    const plain = normalizeProviderDetailPayload(
      { provider: "poe", usage: { primary: { usedPercent: 10 }, loginMethod: "Pro" } },
      "poe",
      now,
    );
    expect(usageSection(plain, "Primary")).not.toHaveProperty("detailText");
  });

  it("copies resetDescription onto a Sub2API extra and the Mistral monthly plan", () => {
    const sub2api = normalizeProviderDetailPayload(
      {
        provider: "sub2api",
        usage: {
          extraRateWindows: [
            { id: "weekly", title: "Weekly", window: { usedPercent: 10, resetDescription: "12 left" } },
          ],
        },
      },
      "sub2api",
      now,
    );
    const sub2Window = sub2api.sections.find((section) => section.kind === "supplementalUsage");
    expect(sub2Window).toMatchObject({ detailText: "12 left" });
    expect(sub2Window).not.toHaveProperty("resetsIn");

    const mistral = normalizeProviderDetailPayload(
      {
        provider: "mistral",
        usage: {
          extraRateWindows: [
            {
              id: "mistral-monthly-plan",
              title: "Monthly",
              window: { usedPercent: 10, resetsAt, resetDescription: "plan left" },
            },
            { id: "other", title: "Other", window: { usedPercent: 10, resetDescription: "nope" } },
          ],
        },
      },
      "mistral",
      now,
    );
    const monthly = mistral.sections.find(
      (section) => section.kind === "supplementalUsage" && section.title === "Monthly",
    );
    const other = mistral.sections.find((section) => section.kind === "supplementalUsage" && section.title === "Other");
    expect(monthly).toMatchObject({ detailText: "plan left", resetsIn: "25d 4h" });
    expect(other).not.toHaveProperty("detailText");
    expect(other).not.toHaveProperty("detailLeftText");
  });

  it("replaces the Kiro overage pace line from the overage rows", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "kiro",
        usage: {
          extraRateWindows: [
            { id: "kiro-overage", title: "Overage", window: { usedPercent: 10, resetDescription: "ignored" } },
            { id: "other", title: "Other", window: { usedPercent: 10 } },
          ],
          details: [
            {
              rows: [
                { label: "Overage credits left", value: "15" },
                { label: "Overage usage", value: "5 credits", secondaryValue: "of 20" },
              ],
            },
          ],
        },
      },
      "kiro",
      now,
    );
    const overage = detail.sections.find(
      (section) => section.kind === "supplementalUsage" && section.title === "Overage",
    );
    const other = detail.sections.find((section) => section.kind === "supplementalUsage" && section.title === "Other");
    expect(overage).toMatchObject({ detailLeftText: "15 of 20 credits left", replacesPace: true });
    expect(overage).not.toHaveProperty("detailText");
    expect(other).not.toHaveProperty("detailLeftText");
    expect(other).not.toHaveProperty("replacesPace");

    const missing = normalizeProviderDetailPayload(
      {
        provider: "kiro",
        usage: {
          extraRateWindows: [{ id: "kiro-overage", title: "Overage", window: { usedPercent: 10 } }],
          details: [{ rows: [{ label: "Overage credits left", value: "15" }] }],
        },
      },
      "kiro",
      now,
    );
    expect(missing.sections.find((section) => section.kind === "supplementalUsage")).not.toHaveProperty(
      "detailLeftText",
    );
  });

  it("leaves resetDescription alone for a provider outside the table", () => {
    for (const [id, resetDescription] of [
      ["devin", "Daily"],
      ["doubao", "1,200 requests left"],
    ] as const) {
      const detail = normalizeProviderDetailPayload(
        { provider: id, usage: { primary: { usedPercent: 10, resetDescription } } },
        id,
        now,
      );
      const section = detail.sections.find((item) => item.kind === "usage");
      expect(section).toBeDefined();
      expect(section).not.toHaveProperty("detailText");
      expect(section).not.toHaveProperty("detailLeftText");
      expect(section).not.toHaveProperty("resetText");
    }
  });

  it("clears Warp's secondary countdown when the detail line is present", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "warp",
        usage: { secondary: { usedPercent: 10, resetsAt, resetDescription: "12 / 40 requests left" } },
      },
      "warp",
      now,
    );
    expect(usageSection(detail, "Secondary")).toMatchObject({
      detailText: "12 / 40 requests left",
      resetsAt,
    });
    expect(usageSection(detail, "Secondary")).not.toHaveProperty("resetsIn");
  });

  it("keeps an Aixy secondary countdown when the window has a date", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "aixy",
        usage: {
          primary: { usedPercent: 10, resetDescription: "1 / 2 left" },
          secondary: { usedPercent: 20, resetsAt, resetDescription: "12 / 40 requests left" },
        },
      },
      "aixy",
      now,
    );
    expect(usageSection(detail, "Primary")).toMatchObject({ detailText: "1 / 2 left" });
    expect(usageSection(detail, "Secondary")).toMatchObject({
      detailText: "12 / 40 requests left",
      resetsIn: "25d 4h",
    });
    expect(usageSection(detail, "Secondary")).not.toHaveProperty("replacesPace");
  });

  it("gives a supplemental meter that is not an extra rate window neither line", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "raycast",
        presentation: {
          schemaVersion: 1,
          meters: [
            {
              kind: "supplemental",
              id: "extra",
              label: "Extra",
              usedPercent: 10,
              remainingPercent: 90,
              resetDescription: balance,
            },
          ],
        },
      },
      "raycast",
      now,
    );
    const supplemental = detail.sections.find((section) => section.kind === "supplementalUsage");
    expect(supplemental).toBeDefined();
    expect(supplemental).not.toHaveProperty("detailText");
    expect(supplemental).not.toHaveProperty("detailLeftText");
    expect(supplemental).not.toHaveProperty("replacesPace");
  });

  it("does not copy a Raycast extra window's reset description", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "raycast",
        usage: {
          primary: { usedPercent: 10, resetDescription: balance },
          extraRateWindows: [{ id: "extra", title: "Extra", window: { usedPercent: 10, resetDescription: balance } }],
        },
      },
      "raycast",
      now,
    );
    expect(usageSection(detail, "Primary")).toMatchObject({ detailText: balance });
    const supplemental = detail.sections.find((section) => section.kind === "supplementalUsage");
    expect(supplemental).not.toHaveProperty("detailText");
    expect(supplemental).not.toHaveProperty("detailLeftText");
  });

  it("uses meterLines when a payload has no presentation", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "raycast",
        usage: { primary: { usedPercent: 33, resetsAt, resetDescription: `  ${balance}  ` } },
      },
      "raycast",
      now,
    );

    expect(detail.presentationSchemaVersion).toBeUndefined();
    expect(usageSection(detail, "Primary")).toMatchObject({ detailText: balance, resetsIn: "25d 4h" });
    expect(usageSection(detail, "Primary")).not.toHaveProperty("metaText");
    expect(usageSection(detail, "Primary")).not.toHaveProperty("pacePercent");
    expect(cardSvg(detail)).toContain(`>${balance}<`);
  });

  it("stacks a schema 1 Raycast pace line over the credits detail", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "raycast",
        presentation: {
          schemaVersion: 1,
          meters: [
            {
              kind: "primary",
              label: "Credits",
              usedPercent: 33,
              remainingPercent: 67,
              windowMinutes: 30 * 24 * 60,
              resetsAt,
              resetDescription: balance,
              nextRegenPercent: 4,
            },
          ],
        },
      },
      "raycast",
      now,
      {
        raycast: {
          ...PROVIDER_MODULES.raycast,
          pace: {
            resetWindowPace: { type: "unsupported" },
            inferredMonthlyDuration: { type: "unsupported" },
            sessionPaceWindowRule: { type: "always" },
          },
        },
      },
    );
    const primary = usageSection(detail, "Primary");
    expect(primary).toMatchObject({ detailText: balance, resetsIn: "25d 4h" });
    expect(primary).not.toHaveProperty("metaText");
    expect(primary).not.toHaveProperty("pacePercent");
    expect(primary?.usagePacing).toBeDefined();

    const svg = cardSvg(detail);
    const parsed = parseSvg(svg);
    const paceLine = formatUsagePacingLine(primary!.usagePacing!);
    expect(svg).toContain(`>${paceLine}<`);
    expect(svg).toContain(`>${balance}<`);
    expect(svg).toContain(">Regenerates 4% next tick<");
    expect(textY(parsed, paceLine)).toBeGreaterThan(textY(parsed, "Credits 67% left"));
    expect(textY(parsed, balance)).toBeGreaterThan(textY(parsed, paceLine));
    expect(textY(parsed, "Regenerates 4% next tick")).toBeGreaterThan(textY(parsed, balance));
  });

  it("copies schema 2 lines for an unknown provider and does not read METER_DETAIL", () => {
    const providerId = "brand-new-provider";
    const tableLine = "from the table";
    METER_DETAIL[providerId] = {
      primaryDescriptionPlacement: "detailLeft",
      showsPrimaryBalanceDescription: true,
    };
    try {
      const detail = normalizeProviderDetailPayload(
        {
          provider: providerId,
          presentation: {
            schemaVersion: 2,
            meters: [
              {
                id: "primary",
                kind: "primary",
                label: "Session",
                usedPercent: 20,
                remainingPercent: 80,
                resetsAt,
                windowMinutes: 300,
                resetDescription: tableLine,
                resetText: "Ready Tuesday",
                metaText: "meta from cli",
                detailText: "detail from cli",
                pacePercent: null,
                nextRegenPercent: 4,
              },
              {
                id: "extra:bonus",
                kind: "supplemental",
                label: "Bonus",
                usedPercent: 30,
                remainingPercent: 70,
                resetsAt,
                resetText: "soon",
                metaText: "extra meta",
                detailText: "extra detail",
                pacePercent: 40,
              },
            ],
          },
          usage: {
            primary: { usedPercent: 99, resetDescription: tableLine },
            details: [
              {
                rows: [
                  { label: "Credits left", value: "1" },
                  { label: "Credits total", value: "2" },
                ],
              },
            ],
          },
        },
        providerId,
        now,
      );
      const primary = usageSection(detail, "Primary");
      const supplemental = detail.sections.find((section) => section.kind === "supplementalUsage");

      expect(detail).toMatchObject({ id: providerId, name: "Brand New Provider", presentationSchemaVersion: 2 });
      expect(primary).toMatchObject({
        displayTitle: "Session",
        remainingPercent: 80,
        resetText: "Ready Tuesday",
        metaText: "meta from cli",
        detailText: "detail from cli",
        resetsAt,
      });
      expect(primary).not.toHaveProperty("detailLeftText");
      expect(primary).not.toHaveProperty("pacePercent");
      expect(primary).not.toHaveProperty("resetsIn");
      expect(primary).not.toHaveProperty("usagePacing");
      expect(primary).not.toHaveProperty("nextRegenPercent");
      expect(primary).not.toHaveProperty("replacesPace");
      expect(supplemental).toMatchObject({
        title: "Bonus",
        remainingPercent: 70,
        resetText: "soon",
        metaText: "extra meta",
        detailText: "extra detail",
        pacePercent: 40,
        usageItemId: "metric:bonus",
      });
      expect(supplemental).not.toHaveProperty("detailLeftText");
      expect(supplemental).not.toHaveProperty("usagePacing");
      expect(supplemental).not.toHaveProperty("resetsIn");

      const svg = cardSvg(detail);
      expect(svg).toContain(">meta from cli<");
      expect(svg).toContain(">detail from cli<");
      expect(svg).toContain(">extra meta<");
      expect(svg).toContain(">extra detail<");
      expect(svg).toContain(">Ready Tuesday<");
      expect(svg).toContain(">soon<");
      expect(svg).not.toContain(tableLine);
      expect(svg).not.toContain("Resets in");
      expect(svg).not.toContain("Regenerates");
      expect(svg).not.toContain("in reserve");
      expect(svg).not.toContain("in deficit");
      expect(svg).not.toContain(">On pace<");
    } finally {
      delete METER_DETAIL[providerId];
    }
  });

  it("draws a schema 2 pace marker from pacePercent and skips the local pace line", () => {
    const paced = normalizeProviderDetailPayload(
      {
        provider: "codex",
        presentation: {
          schemaVersion: 2,
          meters: [
            {
              kind: "primary",
              label: "Session",
              usedPercent: 20,
              remainingPercent: 80,
              windowMinutes: 300,
              resetsAt: "2026-03-23T13:30:00Z",
              resetText: "Ready Tuesday",
              metaText: "80 of 100 left",
              detailText: "second line",
              pacePercent: 40,
              nextRegenPercent: 4,
            },
          ],
        },
      },
      "codex",
      now,
    );
    const primary = usageSection(paced, "Primary");
    expect(primary).toMatchObject({
      metaText: "80 of 100 left",
      detailText: "second line",
      pacePercent: 40,
      resetText: "Ready Tuesday",
    });
    expect(primary).not.toHaveProperty("detailLeftText");
    expect(primary).not.toHaveProperty("usagePacing");
    expect(primary).not.toHaveProperty("resetsIn");
    expect(primary).not.toHaveProperty("nextRegenPercent");

    const svg = cardSvg(paced);
    const parsed = parseSvg(svg);
    expect(textY(parsed, "Ready Tuesday")).toBe(textY(parsed, "Session 80% left"));
    expect(textY(parsed, "80 of 100 left")).toBeGreaterThan(textY(parsed, "Session 80% left"));
    expect(textY(parsed, "second line")).toBeGreaterThan(textY(parsed, "80 of 100 left"));
    expect(rectsWithSize(parsed, 3, 12)).toHaveLength(1);
    expect(rectsWithSize(parsed, 3, 12)[0]?.x).toBe(174.5);
    expect(markerFills(parsed)).toEqual(["#34C759"]);
    expect(svg).not.toContain("Resets in");
    expect(svg).not.toContain("Regenerates");
    expect(svg).not.toContain("in reserve");
    expect(svg).not.toContain("in deficit");
    expect(svg).not.toContain(">On pace<");

    const unpaced = normalizeProviderDetailPayload(
      {
        provider: "codex",
        presentation: {
          schemaVersion: 2,
          meters: [
            {
              kind: "primary",
              label: "Session",
              usedPercent: 20,
              remainingPercent: 80,
              windowMinutes: 300,
              resetsAt: "2026-03-23T13:30:00Z",
              metaText: "80 of 100 left",
              pacePercent: null,
              nextRegenPercent: 4,
            },
          ],
        },
      },
      "codex",
      now,
    );
    const plain = usageSection(unpaced, "Primary");
    expect(plain).toMatchObject({ metaText: "80 of 100 left" });
    expect(plain).not.toHaveProperty("pacePercent");
    expect(plain).not.toHaveProperty("usagePacing");
    expect(plain).not.toHaveProperty("detailLeftText");
    const plainSvg = cardSvg(unpaced);
    const plainParsed = parseSvg(plainSvg);
    expect(plainSvg).toContain(">80 of 100 left<");
    expect(rectsWithSize(plainParsed, 3, 12)).toEqual([]);
    expect(plainSvg).not.toContain("Resets in");
    expect(plainSvg).not.toContain("Regenerates");
    expect(plainSvg).not.toContain("in reserve");
    expect(plainSvg).not.toContain("in deficit");
    expect(plainSvg).not.toContain(">On pace<");
  });
});

describe("provider module interpretation", () => {
  const fixture: ProviderModule = {
    metadata: {
      name: "Fixture",
      iconSlug: "fixture",
      brandColor: "#112233",
      usageSectionLabels: { primary: "Primary", secondary: "Secondary" },
    },
    displayTitle: () => "Fixture window",
    interpret: ({ sections, planText, hasPresentationMeters }) => ({
      sections: [...sections, { kind: "info", title: "Fixture", items: [{ label: "Seen", value: planText ?? "" }] }],
      planText: hasPresentationMeters ? planText : "Fixture plan",
    }),
  };

  it("applies a module label and interpretation after the shared sections exist", () => {
    const detail = normalizeProviderDetailPayload(
      {
        provider: "fixture",
        usage: {
          primary: { usedPercent: 20, resetsAt: "2026-03-23T12:00:00Z" },
          loginMethod: "pro",
        },
      },
      "fixture",
      Date.parse("2026-03-23T10:30:00Z"),
      { fixture },
    );

    expect(detail.planText).toBe("Fixture plan");
    expect(detail.sections[0]).toMatchObject({ kind: "usage", displayTitle: "Fixture window", remainingPercent: 80 });
    expect(detail.sections.at(-1)).toEqual({
      kind: "info",
      title: "Fixture",
      items: [{ label: "Seen", value: "Pro" }],
    });
  });
});
