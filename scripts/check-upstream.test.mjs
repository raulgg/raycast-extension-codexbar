import { describe, expect, it } from "vitest";
import { PROVIDER_CATALOG, PROVIDER_MODULES } from "../src/providers/index.ts";
import { checkUpstream, DEFAULT_POLICY } from "./check-upstream.mjs";
import { MENU_CARD_WATCH_PATHS } from "./lib/meter-detail.mjs";
import {
  compareProviders,
  parseDescriptorMetadata,
  parseDynamicOverrideProviders,
  providerColorToHex,
} from "./lib/upstream-metadata.mjs";
import {
  comparePaceCapabilities,
  dynamicTitleIdsForCheck,
  expandCustomFingerprint,
  extraWindowIdsForCheck,
  moduleAliasProblems,
  paceCapabilitiesForCheck,
  parseDescriptorPace,
  parseExtraRateWindowPaceProviders,
  parseSecondarySessionPaceProviders,
} from "./lib/upstream-pace.mjs";

const CATALOG_FIXTURE = {
  codex: {
    name: "Codex",
    iconSlug: "codex",
    brandColor: "#49A3B0",
    usageSectionLabels: { primary: "Session", secondary: "Weekly" },
    dashboardUrl: "https://chatgpt.com/codex/settings/usage",
    statusPageUrl: "https://status.openai.com/",
  },
  claude: {
    name: "Claude",
    iconSlug: "claude",
    brandColor: "#CC7C5E",
    usageSectionLabels: { primary: "Session", secondary: "Weekly", tertiary: "Sonnet" },
    dashboardUrl: "https://console.anthropic.com/settings/billing",
    subscriptionDashboardUrl: "https://claude.ai/settings/usage",
  },
  mistral: {
    name: "Mistral",
    iconSlug: "mistral",
    brandColor: "#FF500F",
    usageSectionLabels: { primary: "Balance" },
  },
};

function descriptorFixture({
  id = "codex",
  displayName = "Codex",
  sessionLabel = "Session",
  weeklyLabel = "Weekly",
  opusLabel = "nil",
  dashboardURL = '"https://chatgpt.com/codex/settings/usage"',
  statusPageURL = '"https://status.openai.com/"',
  statusLinkURL = "nil",
  color = "red: 73 / 255, green: 163 / 255, blue: 176 / 255",
  pace = "",
  extra = "",
} = {}) {
  const paceField = pace ? `,\n            pace: ${pace}` : "";
  return `
public enum FixtureProviderDescriptor {
    static func makeDescriptor() -> ProviderDescriptor {
        ProviderDescriptor(
            id: .${id},
            metadata: ProviderMetadata(
                id: .${id},
                displayName: "${displayName}",
                sessionLabel: "${sessionLabel}",
                weeklyLabel: "${weeklyLabel}",
                opusLabel: ${opusLabel},
                toggleTitle: "Show usage",
                cliName: "${id}",
                dashboardURL: ${dashboardURL},
                statusPageURL: ${statusPageURL},
                statusLinkURL: ${statusLinkURL}),
            branding: ProviderBranding(
                iconStyle: .monochrome,
                color: ProviderColor(${color}))${paceField})
    }
    ${extra}
}
`;
}

describe("parseDescriptorMetadata", () => {
  it("parses string fields, nil fields, and colors", () => {
    const metadata = parseDescriptorMetadata(descriptorFixture());
    expect(metadata).toMatchObject({
      id: "codex",
      displayName: "Codex",
      sessionLabel: "Session",
      weeklyLabel: "Weekly",
      opusLabel: undefined,
      dashboardURL: "https://chatgpt.com/codex/settings/usage",
      statusPageURL: "https://status.openai.com/",
      statusLinkURL: undefined,
      brandColorHex: "#49A3B0",
      definesDynamicPrimaryLabel: false,
      definesRateWindowLabeler: false,
    });
  });

  it("surfaces non-literal URL values as expr: sentinels", () => {
    const metadata = parseDescriptorMetadata(
      descriptorFixture({ dashboardURL: "ZaiAPIRegion.global.dashboardURL.absoluteString" }),
    );
    expect(metadata.dashboardURL).toBe("expr:ZaiAPIRegion.global.dashboardURL.absoluteString");
  });

  it("reads displayName from the ProviderMetadata literal, not an earlier displayName", () => {
    const metadata = parseDescriptorMetadata(
      `enum Fixture {
            static let credentials = ProviderCredentialAdapter.regionValidator(displayName: "Alibaba Coding Plan")
            ${descriptorFixture({ displayName: "Alibaba" })}
        }`,
    );
    expect(metadata.displayName).toBe("Alibaba");
  });

  it("parses ProviderColor(hex:) branding colors", () => {
    const metadata = parseDescriptorMetadata(
      descriptorFixture().replace(
        "color: ProviderColor(red: 73 / 255, green: 163 / 255, blue: 176 / 255)",
        "color: ProviderColor(hex: 0xA04DFD)",
      ),
    );
    expect(metadata.brandColorHex).toBe("#A04DFD");
  });

  it("treats trailing-paren nil values as absent", () => {
    const metadata = parseDescriptorMetadata(descriptorFixture({ statusPageURL: "nil", statusLinkURL: "nil" }));
    expect(metadata.statusPageURL).toBeUndefined();
    expect(metadata.statusLinkURL).toBeUndefined();
  });

  it("detects descriptor-level dynamic primary labels", () => {
    const metadata = parseDescriptorMetadata(
      descriptorFixture({ extra: "public static func primaryLabel(window: RateWindow?) -> String? { nil }" }),
    );
    expect(metadata.definesDynamicPrimaryLabel).toBe(true);
    expect(metadata.definesRateWindowLabeler).toBe(false);
  });

  it("detects rateWindowLabeler overrides", () => {
    const metadata = parseDescriptorMetadata(
      descriptorFixture({ extra: "let presentation = rateWindowLabeler: { _, _, _ in }" }),
    );
    expect(metadata.definesRateWindowLabeler).toBe(true);
  });

  it("rejects files without exactly one metadata literal", () => {
    expect(() => parseDescriptorMetadata("struct Nothing {}", "Nothing.swift")).toThrow(/expected exactly one/);
    expect(() => parseDescriptorMetadata(descriptorFixture() + descriptorFixture(), "Double.swift")).toThrow(
      /expected exactly one/,
    );
  });

  it("parses a PluginProviderSpec the same way as ProviderMetadata", () => {
    const metadata = parseDescriptorMetadata(`
public enum AixyProviderDescriptor {
    public static let spec = PluginProviderSpec(
        id: .aixy,
        displayName: "Aixy",
        sessionLabel: "Spend",
        weeklyLabel: "Budget",
        dashboardURL: "https://dash.aixy-gateway.com",
        color: ProviderColor(hex: 0x123650),
        aliases: ["aixy-gateway"])
}
`);
    expect(metadata).toMatchObject({
      id: "aixy",
      displayName: "Aixy",
      sessionLabel: "Spend",
      weeklyLabel: "Budget",
      dashboardURL: "https://dash.aixy-gateway.com",
      brandColorHex: "#123650",
      definesDynamicPrimaryLabel: false,
      definesRateWindowLabeler: false,
    });
  });

  it("parses PluginProviderSpec .init colors, nil URLs, and expression URLs", () => {
    const metadata = parseDescriptorMetadata(`
public enum ClinePassProviderDescriptor {
    public static let spec = PluginProviderSpec(
        id: .clinepass,
        displayName: "ClinePass",
        sessionLabel: "Included",
        weeklyLabel: "Weekly",
        opusLabel: "Monthly",
        dashboardURL: nil,
        subscriptionDashboardURL: LLMManSettingsReader.defaultBaseURL.absoluteString,
        statusLinkURL: nil,
        color: .init(red: 0.38, green: 0.64, blue: 0.98))
}
`);
    expect(metadata.opusLabel).toBe("Monthly");
    expect(metadata.dashboardURL).toBeUndefined();
    expect(metadata.statusLinkURL).toBeUndefined();
    expect(metadata.subscriptionDashboardURL).toBe("expr:LLMManSettingsReader.defaultBaseURL.absoluteString");
    expect(metadata.brandColorHex).toBe(providerColorToHex("0.38", "0.64", "0.98"));
  });
});

describe("providerColorToHex", () => {
  it("handles /255 fractions, bare fractions, and bare integers", () => {
    expect(providerColorToHex("16 / 255", "163 / 255", "127 / 255")).toBe("#10A37F");
    expect(providerColorToHex("0.06", "0.51", "0.43")).toBe("#0F826E");
    expect(providerColorToHex("1", "0.6", "0")).toBe("#FF9900");
  });

  it("throws on expressions it cannot evaluate", () => {
    expect(() => providerColorToHex("Color.red", "0", "0")).toThrow(/Unrecognized/);
  });
});

describe("parseDynamicOverrideProviders", () => {
  it("collects descriptor primaryLabel calls and rateWindowLabels conditionals", () => {
    const rendererFixture = `
    private static func rateWindowLabels(provider: UsageProvider) -> Labels {
        if provider == .factory, snapshot.tertiary != nil { return factoryLabels }
        let primaryLabel = if provider == .cursor, snapshot.cursorRequests != nil {
            "Requests"
        } else if provider == .grok {
            GrokProviderDescriptor.primaryLabel(window: snapshot.primary) ?? metadata.sessionLabel
        } else {
            metadata.sessionLabel
        }
    }

    private static func unrelated(provider: UsageProvider) {
        if provider == .codex { }
    }
`;
    const widgetFixture = `
    let title = DoubaoProviderDescriptor.primaryLabel(window: snapshot.primary) ?? "Session"
`;
    const providers = parseDynamicOverrideProviders([
      { path: "MenuDescriptor.swift", content: rendererFixture },
      { path: "Widget.swift", content: widgetFixture },
    ]);
    expect([...providers].sort()).toEqual(["cursor", "doubao", "factory", "grok"]);
  });

  it("throws when a renderer no longer contains any known label site", () => {
    expect(() => parseDynamicOverrideProviders([{ path: "Gone.swift", content: "// nothing here" }])).toThrow(
      /Gone.swift/,
    );
  });

  it("accepts CLI renderers that delegate to presentation.rateWindowLabels", () => {
    const providers = parseDynamicOverrideProviders([
      {
        path: "CLIRenderer.swift",
        content: "let labels = descriptor.presentation.rateWindowLabels(metadata: meta, snapshot: snap)",
      },
    ]);
    expect(providers.size).toBe(0);
  });
});

describe("compareProviders", () => {
  const matchingUpstream = new Map(
    [
      parseDescriptorMetadata(descriptorFixture()),
      parseDescriptorMetadata(
        descriptorFixture({
          id: "claude",
          displayName: "Claude",
          opusLabel: '"Sonnet"',
          dashboardURL: '"https://console.anthropic.com/settings/billing"',
          statusPageURL: "nil",
          color: "red: 204 / 255, green: 124 / 255, blue: 94 / 255",
          extra: 'static let subscription = "x"',
        }),
      ),
      parseDescriptorMetadata(
        descriptorFixture({
          id: "mistral",
          displayName: "Mistral",
          sessionLabel: "Balance",
          weeklyLabel: "",
          dashboardURL: "nil",
          statusPageURL: "nil",
          color: "red: 1.0, green: 80 / 255, blue: 15 / 255",
        }),
      ),
    ].map((metadata) => [metadata.id, metadata]),
  );

  // The claude fixture omits subscriptionDashboardURL, which the registry fixture has.
  const claudeAllowance = {
    claude: {
      subscriptionDashboardUrl: {
        ours: "https://claude.ai/settings/usage",
        upstream: undefined,
        reason: "fixture",
      },
    },
  };

  it("passes when catalog and upstream agree", () => {
    expect(compareProviders(CATALOG_FIXTURE, matchingUpstream, claudeAllowance)).toEqual([]);
  });

  it("throws when the catalog is empty", () => {
    expect(() => compareProviders({}, matchingUpstream)).toThrow(/empty/);
  });

  it("reports field mismatches, missing providers on both sides, and empty-vs-omitted equality", () => {
    const drifted = new Map(matchingUpstream);
    drifted.set("codex", { ...matchingUpstream.get("codex"), sessionLabel: "5-hour" });
    drifted.set("extra", { ...matchingUpstream.get("codex"), id: "extra" });
    drifted.delete("mistral");

    const problems = compareProviders(CATALOG_FIXTURE, drifted, claudeAllowance);
    expect(problems).toContainEqual(
      expect.stringContaining('codex: usageSectionLabels.primary "Session" != upstream "5-hour"'),
    );
    expect(problems).toContainEqual(expect.stringContaining("mistral: present in the provider catalog"));
    expect(problems).toContainEqual(expect.stringContaining("extra: upstream provider missing"));
    expect(problems).toHaveLength(3);
  });

  it("expires allowlist entries when either side moves", () => {
    const allowances = {
      ...claudeAllowance,
      codex: { dashboardUrl: { ours: "https://old.example", upstream: "https://other.example", reason: "fixture" } },
    };
    const problems = compareProviders(CATALOG_FIXTURE, matchingUpstream, allowances);
    expect(problems).toContainEqual(expect.stringContaining("codex: stale ALLOWED_DIVERGENCES entry for dashboardUrl"));
  });

  it("flags allowlist entries that match no comparison", () => {
    const allowances = {
      ...claudeAllowance,
      ghost: { dashboardUrl: { ours: "x", upstream: "y", reason: "fixture" } },
    };
    const problems = compareProviders(CATALOG_FIXTURE, matchingUpstream, allowances);
    expect(problems).toContainEqual(expect.stringContaining("ghost: ALLOWED_DIVERGENCES entry"));
  });
});

describe("parseDescriptorPace", () => {
  it("defaults to unsupported when pace is omitted", () => {
    expect(parseDescriptorPace(descriptorFixture(), "Codex.swift")).toEqual({
      resetWindowPace: { type: "unsupported" },
      inferredMonthlyDuration: { type: "unsupported" },
      sessionPaceWindowRule: { type: "unsupported" },
    });
  });

  it("expands .calendarMonthResetWindow", () => {
    const source = descriptorFixture({ pace: ".calendarMonthResetWindow" });
    expect(parseDescriptorPace(source, "Amp.swift").resetWindowPace).toEqual({
      type: "windowDuration",
      minutes: 43_200,
    });
  });

  it("parses Cursor windowDurationPresent and Grok custom fingerprints", () => {
    expect(
      parseDescriptorPace(
        descriptorFixture({ pace: "ProviderPaceCapability(resetWindowPace: .windowDurationPresent)" }),
        "Cursor.swift",
      ).resetWindowPace,
    ).toEqual({
      type: "windowDurationPresent",
    });

    const grok = `ProviderPaceCapability(
                resetWindowPace: .custom { window, now in
                    guard Self.primaryLabel(window: window, now: now) == "Weekly",
                          let resetsAt = window.resetsAt
                    else { return false }
                    let windowMinutes = window.windowMinutes ?? 7 * 24 * 60
                    let timeUntilReset = resetsAt.timeIntervalSince(now)
                    return windowMinutes > 0
                        && timeUntilReset > 0
                        && timeUntilReset <= TimeInterval(windowMinutes) * 60
                })`;
    const parsed = parseDescriptorPace(descriptorFixture({ pace: grok }), "Grok.swift");
    expect(parsed.resetWindowPace.type).toBe("custom");
    expect(parsed.resetWindowPace.fingerprint).toContain('primaryLabel(window: window, now: now) == "Weekly"');
  });

  it("ignores a pace: comment outside ProviderDescriptor", () => {
    const source = `// pace: .unsupported\n${descriptorFixture({ pace: ".calendarMonthResetWindow" })}`;
    expect(parseDescriptorPace(source, "Amp.swift").resetWindowPace).toEqual({
      type: "windowDuration",
      minutes: 43_200,
    });
  });

  it("expands Self.foo wrappers and Self constants in custom fingerprints", () => {
    const source = descriptorFixture({
      pace: `ProviderPaceCapability(
                resetWindowPace: .custom { window, _ in
                    Self.isMonthlyMCPWindow(window)
                },
                sessionPaceWindowRule: .custom { window, _ in
                    guard let minutes = window.windowMinutes else { return false }
                    return minutes <= Self.rollingWindowMaxMinutes
                })`,
      extra: `
    public static let rollingWindowMaxMinutes = 6 * 60
    private static func isMonthlyMCPWindow(_ window: RateWindow) -> Bool {
        window.windowMinutes == ProviderPaceCapability.monthlyWindowSentinelMinutes
            && window.resetDescription == "MCP"
    }
`,
    });
    const parsed = parseDescriptorPace(source, "Zai.swift");
    expect(parsed.resetWindowPace).toEqual({
      type: "custom",
      fingerprint: 'window.windowMinutes == 43200 && window.resetDescription == "MCP"',
    });
    expect(parsed.sessionPaceWindowRule.fingerprint).toContain("minutes <= 360");
  });

  it("throws on an unparseable pace value", () => {
    expect(() => parseDescriptorPace(descriptorFixture({ pace: ".mystery" }), "X.swift")).toThrow(/unparseable pace/);
  });

  it("strips line comments and parses allowsEstimatedUsage", () => {
    const parsed = parseDescriptorPace(
      descriptorFixture({
        pace: `ProviderPaceCapability(
                resetWindowPace: .windowDuration(minutes: ProviderPaceCapability.monthlyWindowSentinelMinutes),
                inferredMonthlyDuration: .windowDuration(minutes: ProviderPaceCapability.monthlyWindowSentinelMinutes),
                // Device-local costs cannot establish the account's quota usage or billing-cycle boundaries.
                allowsEstimatedUsage: false)`,
      }),
      "OpenCodeGo.swift",
    );
    expect(parsed.resetWindowPace).toEqual({ type: "windowDuration", minutes: 43_200 });
    expect(parsed.allowsEstimatedUsage).toBe(false);
  });

  it("throws on an unknown ProviderPaceCapability field", () => {
    expect(() =>
      parseDescriptorPace(
        descriptorFixture({ pace: "ProviderPaceCapability(mysteryFlag: true)" }),
        "X.swift",
      ),
    ).toThrow(/unknown ProviderPaceCapability field "mysteryFlag"/);
  });
});

describe("expandCustomFingerprint", () => {
  it("inlines a Self.helper call body", () => {
    const source = `
    private static func isMonthlyMCPWindow(_ window: RateWindow) -> Bool {
        window.resetDescription == "MCP"
    }
`;
    expect(expandCustomFingerprint(source, "window, _ in Self.isMonthlyMCPWindow(window)")).toBe(
      'window.resetDescription == "MCP"',
    );
  });
});

describe("parseSecondarySessionPaceProviders", () => {
  it("collects provider == next to sessionPaceDetail inside secondaryMetric", () => {
    const secondary = `
    private static func secondaryMetric(input: Input) -> Metric {
        var paceDetail = if input.provider == .kimi {
            Self.sessionPaceDetail(provider: input.provider, window: weekly)
        }
        return Metric()
    }
`;
    const extras = `
    private static func extraRateWindowPaceDetail(provider: UsageProvider) {
        if provider == .codex {
            return self.sessionPaceDetail(provider: provider, window: window)
        }
    }
`;
    expect([...parseSecondarySessionPaceProviders([{ path: "a.swift", content: secondary }])]).toEqual(["kimi"]);
    expect([...parseSecondarySessionPaceProviders([{ path: "b.swift", content: extras }])]).toEqual([]);
  });
});

describe("parseExtraRateWindowPaceProviders", () => {
  it("collects provider == inside extraRateWindowPaceDetail", () => {
    const content = `
    private static func extraRateWindowPaceDetail(provider: UsageProvider) -> PaceDetail? {
        if provider == .claude, window.windowMinutes != 10080 { return nil }
        guard provider == .codex || provider == .claude || provider == .antigravity else { return nil }
        return nil
    }
`;
    expect([...parseExtraRateWindowPaceProviders([{ path: "a.swift", content }])].sort()).toEqual([
      "antigravity",
      "claude",
      "codex",
    ]);
  });

  it("throws when the helper is missing", () => {
    expect(() => parseExtraRateWindowPaceProviders([{ path: "Gone.swift", content: "// nothing" }])).toThrow(
      /extraRateWindowPaceDetail/,
    );
  });
});

describe("comparePaceCapabilities", () => {
  const grokOurs = new Map([
    [
      "grok",
      {
        resetWindowPace: { type: "custom", id: "grokWeeklyCredits" },
        inferredMonthlyDuration: { type: "unsupported" },
        sessionPaceWindowRule: { type: "unsupported" },
      },
    ],
  ]);

  it("maps matching custom fingerprints onto ids", () => {
    const grok = parseDescriptorPace(
      descriptorFixture({
        pace: `ProviderPaceCapability(
                resetWindowPace: .custom { window, now in
                    guard Self.primaryLabel(window: window, now: now) == "Weekly"
                    else { return false }
                })`,
      }),
      "Grok.swift",
    );
    const { problems } = comparePaceCapabilities(grokOurs, new Map([["grok", { pace: grok }]]), {
      "grok.resetWindowPace": {
        id: "grokWeeklyCredits",
        fingerprint: grok.resetWindowPace.fingerprint,
      },
    });
    expect(problems).toEqual([]);
  });

  it("maps Notion's rolling-session fingerprint onto windowDurationAtMost", () => {
    const source = descriptorFixture({
      id: "notion",
      extra: "public static let rollingWindowMaxMinutes = 6 * 60",
      pace: `ProviderPaceCapability(
                resetWindowPace: .windowDuration(minutes: 43200),
                inferredMonthlyDuration: .windowDuration(minutes: 43200),
                sessionPaceWindowRule: .custom { window, _ in
                    guard let minutes = window.windowMinutes else { return false }
                    return minutes <= Self.rollingWindowMaxMinutes
                })`,
    });
    const parsed = parseDescriptorPace(source, "Notion.swift");
    const fingerprint =
      "window, _ in guard let minutes = window.windowMinutes else { return false } return minutes <= 360";
    expect(parsed.sessionPaceWindowRule.fingerprint).toBe(fingerprint);
    const rules = {
      "notion.sessionPaceWindowRule": { matcher: "windowDurationAtMost", fingerprint },
    };
    const upstream = new Map([["notion", { pace: parsed }]]);
    const notionPace = {
      resetWindowPace: { type: "windowDuration", minutes: 43_200 },
      inferredMonthlyDuration: { type: "windowDuration", minutes: 43_200 },
      sessionPaceWindowRule: { type: "windowDurationAtMost", minutes: 360 },
    };
    expect(comparePaceCapabilities(new Map([["notion", notionPace]]), upstream, rules).problems).toEqual([]);
    expect(
      comparePaceCapabilities(
        new Map([
          [
            "notion",
            {
              ...notionPace,
              sessionPaceWindowRule: { type: "windowDurationAtMost", minutes: 300 },
            },
          ],
        ]),
        upstream,
        rules,
      ).problems,
    ).toEqual([
      'notion: sessionPaceWindowRule {"type":"windowDurationAtMost","minutes":300} != upstream {"type":"windowDurationAtMost","minutes":360}',
    ]);
  });

  it("maps Claude's always-true session fingerprint onto always", () => {
    const parsed = parseDescriptorPace(
      descriptorFixture({
        pace: `ProviderPaceCapability(
                sessionPaceWindowRule: .custom { _, _ in true })`,
      }),
      "Claude.swift",
    );
    const fingerprint = "_, _ in true";
    expect(parsed.sessionPaceWindowRule.fingerprint).toBe(fingerprint);
    const rules = {
      "claude.sessionPaceWindowRule": { matcher: "always", fingerprint },
    };
    const upstream = new Map([["claude", { pace: parsed }]]);
    const claudePace = {
      resetWindowPace: { type: "unsupported" },
      inferredMonthlyDuration: { type: "unsupported" },
      sessionPaceWindowRule: { type: "always" },
    };
    expect(comparePaceCapabilities(new Map([["claude", claudePace]]), upstream, rules).problems).toEqual([]);
    expect(
      comparePaceCapabilities(
        new Map([
          [
            "claude",
            {
              ...claudePace,
              sessionPaceWindowRule: { type: "custom", id: "claudeSessionAlways" },
            },
          ],
        ]),
        upstream,
        rules,
      ).problems,
    ).toEqual([
      'claude: sessionPaceWindowRule {"type":"custom","id":"claudeSessionAlways"} != upstream {"type":"always"}',
    ]);
  });

  it("maps Ollama's at-most-five-hours fingerprint onto windowDurationAtMost", () => {
    const parsed = parseDescriptorPace(
      descriptorFixture({
        pace: `ProviderPaceCapability(
                sessionPaceWindowRule: .custom { window, _ in
                    guard let minutes = window.windowMinutes else { return false }
                    return minutes <= 300
                })`,
      }),
      "Ollama.swift",
    );
    const fingerprint =
      "window, _ in guard let minutes = window.windowMinutes else { return false } return minutes <= 300";
    expect(parsed.sessionPaceWindowRule.fingerprint).toBe(fingerprint);
    const rules = {
      "ollama.sessionPaceWindowRule": { matcher: "windowDurationAtMost", fingerprint },
    };
    const upstream = new Map([["ollama", { pace: parsed }]]);
    const ollamaPace = {
      resetWindowPace: { type: "unsupported" },
      inferredMonthlyDuration: { type: "unsupported" },
      sessionPaceWindowRule: { type: "windowDurationAtMost", minutes: 300 },
    };
    expect(comparePaceCapabilities(new Map([["ollama", ollamaPace]]), upstream, rules).problems).toEqual([]);
    expect(
      comparePaceCapabilities(
        new Map([
          [
            "ollama",
            {
              ...ollamaPace,
              sessionPaceWindowRule: { type: "windowDurationAtMost", minutes: 360 },
            },
          ],
        ]),
        upstream,
        rules,
      ).problems,
    ).toEqual([
      'ollama: sessionPaceWindowRule {"type":"windowDurationAtMost","minutes":360} != upstream {"type":"windowDurationAtMost","minutes":300}',
    ]);
  });

  it("maps Amp's renews-in fingerprint onto the module predicate", () => {
    const fingerprint =
      'window, _ in window.windowMinutes != nil && window.resetDescription?.hasPrefix("renews in ") == true';
    const parsed = parseDescriptorPace(
      descriptorFixture({
        pace: `ProviderPaceCapability(
                resetWindowPace: .custom { window, _ in
                    window.windowMinutes != nil && window.resetDescription?.hasPrefix("renews in ") == true
                })`,
      }),
      "Amp.swift",
    );
    expect(parsed.resetWindowPace.fingerprint).toBe(fingerprint);
    const rules = {
      "amp.resetWindowPace": { matcher: "predicate", id: "ampRenewsInDescription", fingerprint },
    };
    const upstream = new Map([["amp", { pace: parsed }]]);
    const ampPace = {
      resetWindowPace: { type: "predicate", id: "ampRenewsInDescription", matches: () => true },
      inferredMonthlyDuration: { type: "unsupported" },
      sessionPaceWindowRule: { type: "unsupported" },
    };
    expect(comparePaceCapabilities(new Map([["amp", ampPace]]), upstream, rules).problems).toEqual([]);
    expect(
      comparePaceCapabilities(
        new Map([
          [
            "amp",
            {
              ...ampPace,
              resetWindowPace: { type: "predicate", id: "grokWeeklyCredits", matches: () => true },
            },
          ],
        ]),
        upstream,
        rules,
      ).problems,
    ).toEqual([
      'amp: resetWindowPace {"type":"predicate","id":"grokWeeklyCredits"} != upstream {"type":"predicate","id":"ampRenewsInDescription"}',
    ]);
    expect(
      comparePaceCapabilities(
        new Map([
          [
            "amp",
            {
              ...ampPace,
              resetWindowPace: { type: "predicate", id: "ampRenewsInDescription" },
            },
          ],
        ]),
        upstream,
        rules,
      ).problems,
    ).toEqual([
      'amp: resetWindowPace {"type":"predicate","id":"ampRenewsInDescription","matches":false} != upstream {"type":"predicate","id":"ampRenewsInDescription"}',
    ]);
  });

  it("binds moved custom fingerprints to the module predicates", () => {
    for (const [key, rule] of Object.entries(DEFAULT_POLICY.customPaceRules)) {
      if (rule.matcher !== "predicate") continue;
      const [providerId, field] = key.split(".");
      const paceRule = PROVIDER_MODULES[providerId].pace[field];
      expect(paceRule, key).toMatchObject({ type: "predicate", id: rule.id });
      expect(typeof paceRule.matches, key).toBe("function");
    }
  });

  it("prints the field that diverged", () => {
    const grok = parseDescriptorPace(
      descriptorFixture({
        pace: "ProviderPaceCapability(resetWindowPace: .windowDurationPresent)",
      }),
      "Grok.swift",
    );
    const { problems } = comparePaceCapabilities(grokOurs, new Map([["grok", { pace: grok }]]), {});
    expect(problems).toEqual([
      'grok: resetWindowPace {"type":"custom","id":"grokWeeklyCredits"} != upstream {"type":"windowDurationPresent"}',
    ]);
  });

  it("reports allowsEstimatedUsage drift", () => {
    const parsed = parseDescriptorPace(
      descriptorFixture({
        pace: "ProviderPaceCapability(allowsEstimatedUsage: false)",
      }),
      "OpenCodeGo.swift",
    );
    const { problems } = comparePaceCapabilities(
      new Map([
        [
          "opencodego",
          {
            resetWindowPace: { type: "unsupported" },
            inferredMonthlyDuration: { type: "unsupported" },
            sessionPaceWindowRule: { type: "unsupported" },
          },
        ],
      ]),
      new Map([["opencodego", { pace: parsed }]]),
      {},
    );
    expect(problems).toEqual(["opencodego: allowsEstimatedUsage true != upstream false"]);
  });
});

function fakeSource(files, { sha, changed = [] } = {}) {
  return {
    label: "fixture tree",
    sha,
    listChangedPaths: async () => changed,
    listFiles: async (prefix, suffix) =>
      Object.keys(files).filter((filePath) => filePath.startsWith(prefix) && filePath.endsWith(suffix)),
    readFile: async (filePath) => {
      if (!(filePath in files)) {
        throw new Error(`missing ${filePath}`);
      }
      return files[filePath];
    },
  };
}

const TOY_CATALOG = {
  toy: {
    name: "Codex",
    iconSlug: "toy",
    brandColor: "#49A3B0",
    usageSectionLabels: { primary: "Session", secondary: "Weekly" },
    dashboardUrl: "https://chatgpt.com/codex/settings/usage",
    statusPageUrl: "https://status.openai.com/",
  },
};

const TOY_PACE = {
  toy: {
    resetWindowPace: { type: "unsupported" },
    inferredMonthlyDuration: { type: "unsupported" },
    sessionPaceWindowRule: { type: "unsupported" },
  },
};

const LABEL_RENDERER = "let labels = descriptor.presentation.rateWindowLabels(metadata: meta, snapshot: snap)\n";
const PACE_RENDERER = "func extraRateWindowPaceDetail(provider: UsageProvider) -> PaceDetail? { return nil }\n";

const TOY_POLICY = {
  catalog: TOY_CATALOG,
  paceCapabilities: TOY_PACE,
  extraWindowIds: new Set(),
  implementedTitles: new Set(),
  unportableTitles: {},
  customPaceRules: {},
  allowedDivergences: {},
  unportableHeadroom: {},
  unportablePresentation: {},
  meterDetail: {},
  unportableMenuCard: {},
  rendererPaths: ["Sources/CodexBar/MenuDescriptor.swift"],
  paceRendererPaths: ["Sources/CodexBar/MenuCardView.swift"],
};

describe("checkUpstream", () => {
  it("passes a matching one-provider fixture tree", async () => {
    const result = await checkUpstream(
      fakeSource({
        "Sources/CodexBarCore/Providers/Toy/ToyProviderDescriptor.swift": descriptorFixture({ id: "toy" }),
        "Sources/CodexBar/MenuDescriptor.swift": LABEL_RENDERER,
        "Sources/CodexBar/MenuCardView.swift": PACE_RENDERER,
      }),
      TOY_POLICY,
    );
    expect(result.problems).toEqual([]);
  });

  it("fails when the catalog omits an upstream provider", async () => {
    const result = await checkUpstream(
      fakeSource({
        "Sources/CodexBarCore/Providers/Toy/ToyProviderDescriptor.swift": descriptorFixture({ id: "toy" }),
        "Sources/CodexBar/MenuDescriptor.swift": LABEL_RENDERER,
        "Sources/CodexBar/MenuCardView.swift": PACE_RENDERER,
      }),
      { ...TOY_POLICY, catalog: { other: TOY_CATALOG.toy } },
    );
    expect(result.problems.some((problem) => problem.includes("toy: upstream provider missing"))).toBe(true);
  });

  it("fails when a descriptor rateWindowLabeler is not ported", async () => {
    const result = await checkUpstream(
      fakeSource({
        "Sources/CodexBarCore/Providers/Toy/ToyProviderDescriptor.swift": descriptorFixture({
          id: "toy",
          extra: "let labeler = rateWindowLabeler: { _, _, _ in }",
        }),
        "Sources/CodexBar/MenuDescriptor.swift": LABEL_RENDERER,
        "Sources/CodexBar/MenuCardView.swift": PACE_RENDERER,
      }),
      TOY_POLICY,
    );
    expect(result.problems.some((problem) => problem.includes("toy: upstream renderers apply a dynamic"))).toBe(true);
  });

  it("fails when descriptor pace: drifts from the imported table", async () => {
    const result = await checkUpstream(
      fakeSource({
        "Sources/CodexBarCore/Providers/Toy/ToyProviderDescriptor.swift": descriptorFixture({
          id: "toy",
          pace: "ProviderPaceCapability(resetWindowPace: .windowDurationPresent)",
        }),
        "Sources/CodexBar/MenuDescriptor.swift": LABEL_RENDERER,
        "Sources/CodexBar/MenuCardView.swift": PACE_RENDERER,
      }),
      TOY_POLICY,
    );
    expect(result.problems.some((problem) => problem.includes("toy: resetWindowPace"))).toBe(true);
  });

  it("uses a module pace row instead of the legacy table", async () => {
    const result = await checkUpstream(toyTree({ pace: "ProviderPaceCapability(resetWindowPace: .windowDurationPresent)" }), {
      ...TOY_POLICY,
      modules: { toy: { pace: WINDOW_PACE } },
    });
    expect(result.problems).toEqual([]);
  });

  it("does not keep the legacy pace row when the module sets pace", async () => {
    const result = await checkUpstream(toyTree({ pace: "ProviderPaceCapability(resetWindowPace: .windowDurationPresent)" }), {
      ...TOY_POLICY,
      paceCapabilities: { toy: WINDOW_PACE },
      modules: { toy: { pace: TOY_PACE.toy } },
    });
    expect(result.problems.some((problem) => problem.includes("toy: resetWindowPace"))).toBe(true);
  });

  it("keeps the legacy pace row when the module sets no pace", async () => {
    const result = await checkUpstream(toyTree(), {
      ...TOY_POLICY,
      modules: { toy: { aliases: ["toy-alias"] } },
    });
    expect(result.problems).toEqual([]);
  });

  it("treats a module displayTitle as the dynamic label override", async () => {
    const result = await checkUpstream(toyTree({ extra: "let labeler = rateWindowLabeler: { _, _, _ in }" }), {
      ...TOY_POLICY,
      modules: { toy: { displayTitle: () => "Toy" } },
    });
    expect(result.problems).toEqual([]);
  });

  it("reports a module displayTitle the renderers no longer apply", async () => {
    const result = await checkUpstream(toyTree(), {
      ...TOY_POLICY,
      modules: { toy: { displayTitle: () => "Toy" } },
    });
    expect(result.problems.some((problem) => problem.includes("toy: listed as a dynamic override"))).toBe(true);
  });

  it("treats module extraWindowPace as extra-window membership", async () => {
    const result = await checkUpstream(toyTree({}, TOY_EXTRA_RENDERER), {
      ...TOY_POLICY,
      modules: { toy: { extraWindowPace: "weekly-only" } },
    });
    expect(result.problems).toEqual([]);
  });

  it("still requires the legacy extra-window set when the module sets none", async () => {
    const result = await checkUpstream(toyTree({}, TOY_EXTRA_RENDERER), TOY_POLICY);
    expect(result.problems.some((problem) => problem.includes("toy: MenuCardView paces extra rate windows"))).toBe(true);
  });

  it("fails when two modules share an alias", async () => {
    const result = await checkUpstream(toyTree(), {
      ...TOY_POLICY,
      modules: {
        other: { aliases: ["shared"] },
        toy: { aliases: ["shared"] },
      },
    });
    expect(result.problems).toEqual([`alias "shared" is shared by other and toy`]);
  });

  it("fails when an alias is a provider id", async () => {
    const result = await checkUpstream(toyTree(), {
      ...TOY_POLICY,
      modules: { moved: { aliases: ["toy"] } },
    });
    expect(result.problems).toEqual([`moved: alias "toy" is a provider id`]);
  });

  it("treats a descriptor with no menu card call as the defaults", async () => {
    const result = await checkUpstream(toyTree(), TOY_POLICY);
    expect(result.problems).toEqual([]);
    expect(result.meterEntries).toEqual({});
  });

  it("fails when a descriptor has two menu card calls", async () => {
    const result = await checkUpstream(
      toyTree({
        extra: `
          let first = ProviderMenuCardPresentation(showsPrimaryBalanceDescription: true)
          let second = ProviderMenuCardPresentation(showsSecondaryBalanceDescription: true)
        `,
      }),
      TOY_POLICY,
    );
    expect(result.problems.some((problem) => problem.includes("2 ProviderMenuCardPresentation calls"))).toBe(true);
  });

  it("fails when a balance flag is missing from meterDetail.ts", async () => {
    const result = await checkUpstream(
      toyTree({ extra: "let card = ProviderMenuCardPresentation(showsPrimaryBalanceDescription: true)" }),
      TOY_POLICY,
    );
    expect(result.problems.some((problem) => problem.includes("Regenerate src/providers/meterDetail.ts"))).toBe(true);
    expect(result.meterEntries).toEqual({ toy: { primary: true } });
  });

  it("requires an unportable entry for request quota and rejects a stale one", async () => {
    const card = toyTree({ extra: "let card = ProviderMenuCardPresentation(primaryDetailKind: .requestQuota)" });
    const missing = await checkUpstream(card, TOY_POLICY);
    expect(missing.problems.some((problem) => problem.includes("primaryDetailKind .requestQuota"))).toBe(true);

    const ported = await checkUpstream(card, {
      ...TOY_POLICY,
      unportableMenuCard: { toy: { requestQuota: "CLI JSON does not expose the Request quota row" } },
    });
    expect(ported.problems).toEqual([]);

    const stale = await checkUpstream(toyTree(), {
      ...TOY_POLICY,
      unportableMenuCard: { toy: { requestQuota: "stale" } },
    });
    expect(stale.problems).toEqual(["toy: stale UNPORTABLE_MENU_CARD entry for requestQuota. Delete it."]);
  });

  it("fails on a non-default menu card closure until it is named", async () => {
    const card = toyTree({
      extra: "let card = ProviderMenuCardPresentation(usageNotesResolver: { _ in .custom })",
    });
    const missing = await checkUpstream(card, TOY_POLICY);
    expect(missing.problems.some((problem) => problem.includes("usageNotesResolver"))).toBe(true);

    const trivial = await checkUpstream(
      toyTree({ extra: "let card = ProviderMenuCardPresentation(usageNotesResolver: { _ in .unhandled })" }),
      TOY_POLICY,
    );
    expect(trivial.problems).toEqual([]);
  });

  it("prints a changed plugin path until menuCardReviewed matches the candidate", async () => {
    const reviewed = "a".repeat(40);
    const candidate = "b".repeat(40);
    const result = await checkUpstream(
      fakeSource(toyFiles(), {
        sha: candidate,
        changed: ["Sources/CodexBarCore/Resources/Plugins/raycast.js", "README.md"],
      }),
      {
        ...TOY_POLICY,
        pinnedSha: reviewed,
        menuCardReviewed: { sha: reviewed, paths: [...MENU_CARD_WATCH_PATHS] },
      },
    );
    const text = result.problems.join("\n");
    expect(text).toContain("raycast.js");
    expect(text).toContain(candidate);
    expect(text).not.toContain("README.md");
  });

  it("still names an unlisted plugin path when menuCardReviewed.sha is the candidate", async () => {
    const pin = "a".repeat(40);
    const candidate = "b".repeat(40);
    const plugin = "Sources/CodexBarCore/Resources/Plugins/raycast.js";
    const calls = [];
    const source = fakeSource(toyFiles(), { sha: candidate });
    source.listChangedPaths = async (from, to) => {
      calls.push([from, to]);
      return [plugin];
    };
    const missing = await checkUpstream(source, {
      ...TOY_POLICY,
      pinnedSha: pin,
      menuCardReviewed: { sha: candidate, paths: [...MENU_CARD_WATCH_PATHS] },
    });
    expect(calls).toEqual([[pin, candidate]]);
    expect(missing.problems.join("\n")).toContain("raycast.js");

    const listed = await checkUpstream(source, {
      ...TOY_POLICY,
      pinnedSha: pin,
      menuCardReviewed: { sha: candidate, paths: [...MENU_CARD_WATCH_PATHS, plugin] },
    });
    expect(listed.problems).toEqual([]);
  });
});

const WINDOW_PACE = {
  resetWindowPace: { type: "windowDurationPresent" },
  inferredMonthlyDuration: { type: "unsupported" },
  sessionPaceWindowRule: { type: "unsupported" },
};

const TOY_EXTRA_RENDERER = `func extraRateWindowPaceDetail(provider: UsageProvider) -> PaceDetail? {
  if provider == .toy { return nil }
  return nil
}
`;

function toyFiles(descriptor = {}, paceRenderer = PACE_RENDERER) {
  return {
    "Sources/CodexBarCore/Providers/Toy/ToyProviderDescriptor.swift": descriptorFixture({ id: "toy", ...descriptor }),
    "Sources/CodexBar/MenuDescriptor.swift": LABEL_RENDERER,
    "Sources/CodexBar/MenuCardView.swift": paceRenderer,
  };
}

function toyTree(descriptor = {}, paceRenderer = PACE_RENDERER) {
  return fakeSource(toyFiles(descriptor, paceRenderer));
}

describe("provider module pace overlay", () => {
  it("replaces a legacy pace row and leaves a module with no pace on the old table", () => {
    const modulePace = { ...WINDOW_PACE };
    expect(paceCapabilitiesForCheck({ toy: TOY_PACE.toy }, { toy: { pace: modulePace } }).toy).toBe(modulePace);
    expect(paceCapabilitiesForCheck({ toy: TOY_PACE.toy }, { toy: {} }).toy).toEqual(TOY_PACE.toy);
    expect(paceCapabilitiesForCheck({}, { plain: {} }).plain).toBeUndefined();
  });

  it("counts a module displayTitle and either extra-window pace", () => {
    expect([...dynamicTitleIdsForCheck(new Set(["factory"]), { toy: { displayTitle: () => "Toy" }, plain: {} })]).toEqual([
      "factory",
      "toy",
    ]);
    expect(
      [
        ...extraWindowIdsForCheck(new Set(["codex"]), {
          claude: { extraWindowPace: "weekly-only" },
          antigravity: { extraWindowPace: "session-or-weekly" },
          plain: {},
        }),
      ].sort(),
    ).toEqual(["antigravity", "claude", "codex"]);
  });

  it("fails when aliases collide with each other or with a provider id", () => {
    expect(
      moduleAliasProblems(
        {
          one: { aliases: ["shared", "toy"] },
          two: { aliases: ["shared"] },
        },
        ["toy", "legacy"],
      ),
    ).toEqual([`one: alias "toy" is a provider id`, `alias "shared" is shared by one and two`]);
    expect(moduleAliasProblems({ one: { aliases: ["two"] }, two: {} }, [])).toEqual([
      `one: alias "two" is a provider id`,
    ]);
  });

  it("accepts the committed module aliases", () => {
    expect(moduleAliasProblems(PROVIDER_MODULES, Object.keys(PROVIDER_CATALOG))).toEqual([]);
  });
});

