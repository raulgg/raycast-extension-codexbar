import { describe, expect, it } from "vitest";
import { collectProviderMentions, pruneProviderSources } from "./lib/prune-provider.mjs";

function prune(files, id, iconSlug = id) {
  return pruneProviderSources(files, { id, iconSlug, deleteIcon: true });
}

describe("pruneProviderSources", () => {
  it("removes a generic provider from the catalog, aliases, and mocks", () => {
    const result = prune({
      "src/providers/catalog.ts": `export const PROVIDER_CATALOG = {
  codex: {
    name: "Codex",
    iconSlug: "codex",
  },
  zoommate: {
    name: "ZoomMate",
    iconSlug: "zoommate",
    dashboardUrl: "https://zoommate.example",
  },
  claude: {
    name: "Claude",
    iconSlug: "claude",
  },
} satisfies Record<string, ProviderCatalogEntry>;

export const PROVIDER_ID_ALIASES: Record<string, string> = {
  "z.ai": "zai",
  zm: "zoommate",
  hf: "huggingface",
};
`,
      "src/cli/mockPayloads.ts": `const MOCK_SOURCES: Record<string, string> = {
  codex: "codex-cli",
  zoommate: "web",
  claude: "web",
};

const MOCK_BUILDERS: Record<string, MockBuilder> = {
  codex: buildCodex,
  zoommate: buildZoom,
  claude: buildGenericProvider("claude"),
};

function buildZoom(now: Date): MockBuilder {
  return () => ({ provider: "zoommate", now });
}

function buildGenericProvider(providerId: string): MockBuilder {
  return () => ({ provider: providerId });
}
`,
    }, "zoommate");

    expect(result.files["src/providers/catalog.ts"]).toBe(`export const PROVIDER_CATALOG = {
  codex: {
    name: "Codex",
    iconSlug: "codex",
  },
  claude: {
    name: "Claude",
    iconSlug: "claude",
  },
} satisfies Record<string, ProviderCatalogEntry>;

export const PROVIDER_ID_ALIASES: Record<string, string> = {
  "z.ai": "zai",
  hf: "huggingface",
};
`);
    expect(result.files["src/cli/mockPayloads.ts"]).toContain('codex: "codex-cli"');
    expect(result.files["src/cli/mockPayloads.ts"]).toContain('buildGenericProvider("claude")');
    expect(result.files["src/cli/mockPayloads.ts"]).not.toContain("zoommate: ");
    expect(result.files["src/cli/mockPayloads.ts"]).toContain("function buildZoom");
    expect(result.files["src/cli/mockPayloads.ts"]).toContain("function buildGenericProvider");
    expect(result.deleted).toEqual(["assets/provider-icons/zoommate.svg"]);
    expect(result.mentions).toContain("src/cli/mockPayloads.ts: mock builder buildZoom is still declared");
  });

  it("leaves tests in place and reports every remaining mention", () => {
    const testSource = `describe("provider registry", () => {
  it("resolves the zoommate alias", () => {
    expect(resolveProviderId("zm")).toBe("zoommate");
  });
});
`;
    const result = prune({ "src/providers/registry.test.ts": testSource }, "zoommate");

    expect(result.files["src/providers/registry.test.ts"]).toBe(testSource);
    expect(result.mentions).toEqual(["src/providers/registry.test.ts:3"]);
  });

  it("deletes pace rows and the provider-rules file without rewriting call sites", () => {
    const normalize = `import { applyCodexWeeklySessionCap } from "./providerRules/codex";

function capSessions(providerId: string, sections: unknown[]) {
  if (providerId === "codex") {
    return applyCodexWeeklySessionCap(sections);
  }
  return sections;
}
`;
    const registry = `export function resolveDashboardUrl(providerId: string) {
  if (providerId === "codex") {
    return "only-codex";
  }
  return "https://example.com";
}
`;
    const result = prune(
      {
        "src/usage/providerRules/codex.ts": `export function applyCodexWeeklySessionCap() {\n  return [];\n}\n`,
        "src/usage/normalize.ts": normalize,
        "src/providers/registry.ts": registry,
        "src/providers/paceCapabilities.ts": `export type PaceCustomId =
  | "codexSessionRejectsWeeklyMonthly"
  | "claudeSessionAlways";

function codexSessionRejectsWeeklyMonthly(): boolean {
  return true;
}

export const CUSTOM_WINDOW_RULES = {
  codexSessionRejectsWeeklyMonthly,
  claudeSessionAlways: () => true,
};

export const PACE_CAPABILITIES = {
  codex: {
    resetWindowPace: { type: "custom", id: "codexSessionRejectsWeeklyMonthly" },
  },
  claude: {
    resetWindowPace: { type: "unsupported" },
  },
};

export const EXTRA_WINDOW_PACE_PROVIDER_IDS = new Set(["codex", "claude"]);
`,
        "scripts/check-upstream.mjs": `const CUSTOM_PACE_RULES = {
  "codex.sessionPaceWindowRule": { id: "codexSessionRejectsWeeklyMonthly" },
  "claude.sessionPaceWindowRule": { id: "claudeSessionAlways" },
};

const ALLOWED_DIVERGENCES = {
  codex: { dashboardUrl: { ours: "https://codex.example", upstream: "expr:Codex", reason: "region" } },
  claude: { dashboardUrl: { ours: "https://claude.example", upstream: "expr:Claude", reason: "region" } },
};
`,
        "src/other.ts": `if (ready) {\n}\n`,
      },
      "codex",
    );

    expect(result.files["src/usage/providerRules/codex.ts"]).toBeUndefined();
    expect(result.deleted).toContain("src/usage/providerRules/codex.ts");
    expect(result.files["src/usage/normalize.ts"]).toBe(normalize);
    expect(result.files["src/providers/registry.ts"]).toBe(registry);
    expect(result.files["src/other.ts"]).toBe(`if (ready) {\n}\n`);
    expect(result.files["src/providers/paceCapabilities.ts"]).toContain("function codexSessionRejectsWeeklyMonthly");
    expect(result.files["src/providers/paceCapabilities.ts"]).not.toContain('resetWindowPace: { type: "custom"');
    expect(result.files["src/providers/paceCapabilities.ts"]).toContain("claudeSessionAlways");
    expect(result.files["src/providers/paceCapabilities.ts"]).toContain('new Set(["claude"])');
    expect(result.files["src/providers/paceCapabilities.ts"]).not.toContain('| "codexSessionRejectsWeeklyMonthly"');
    expect(result.files["scripts/check-upstream.mjs"]).not.toContain("codex.sessionPaceWindowRule");
    expect(result.files["scripts/check-upstream.mjs"]).toContain("claude.sessionPaceWindowRule");
    expect(result.mentions).toContain(
      "src/providers/paceCapabilities.ts: pace rule codexSessionRejectsWeeklyMonthly is still declared",
    );
    expect(result.mentions).toContain("src/usage/normalize.ts:1");
    expect(result.mentions).toContain("src/providers/registry.ts:2");
  });

  it("does not rewrite a ternary that names the provider", () => {
    const identity = `import { extractKiloPass } from "./providerRules/kilo";

export function formatPlanText(providerId: string, rawPlanText: string) {
  const providerScopedPlanText = providerId === "kilo" ? extractKiloPass(rawPlanText) : rawPlanText;
  return providerScopedPlanText;
}
`;
    const result = prune(
      {
        "src/usage/identity.ts": identity,
        "src/usage/providerRules/kilo.ts": `export function extractKiloPass(rawPlanText: string) {\n  return rawPlanText;\n}\n`,
      },
      "kilo",
    );

    expect(result.files["src/usage/identity.ts"]).toBe(identity);
    expect(result.files["src/usage/providerRules/kilo.ts"]).toBeUndefined();
    expect(result.mentions).toContain("src/usage/identity.ts:1");
    expect(result.mentions).toContain("src/usage/identity.ts:4");
  });

  it("ignores lookalikes and a shared icon slug", () => {
    const result = pruneProviderSources(
      {
        "src/providers/catalog.ts": `export const PROVIDER_CATALOG = {
  v0: { name: "v0", iconSlug: "v0" },
};
`,
        "scripts/lib/upstream.test.mjs": `expect(assertSafeUpstreamRef("v0.55.1")).toBe("v0.55.1");\n`,
        "scripts/lib/upstream-metadata.mjs": `// delegate to each descriptor's presentation labeler (v0.53+)\n`,
      },
      { id: "v0", iconSlug: "v0", deleteIcon: true },
    );
    expect(result.mentions).toEqual([]);

    const amp = pruneProviderSources(
      {
        "src/providers/catalog.ts": `export const PROVIDER_CATALOG = {\n  amp: { name: "Amp", iconSlug: "amp" },\n};\n`,
        "src/render/svg.ts": `return text.replace(/&/g, "&amp;");\n`,
      },
      { id: "amp", iconSlug: "amp", deleteIcon: true },
    );
    expect(amp.mentions).toEqual([]);

    const cursor = pruneProviderSources(
      {
        "src/providers/catalog.ts": `export const PROVIDER_CATALOG = {\n  cursor: { name: "Cursor", iconSlug: "cursor" },\n};\n`,
        "scripts/lib/prune-provider.mjs": `for (let cursor = index; cursor < source.length; cursor += 1) {\n`,
        "src/usage/normalize.ts": `if (providerId === "cursor") {\n  return sections;\n}\n`,
      },
      { id: "cursor", iconSlug: "cursor", deleteIcon: true },
    );
    expect(cursor.mentions).toEqual(["src/usage/normalize.ts:1"]);

    const sharedIcon = pruneProviderSources(
      {
        "src/providers/catalog.ts": `export const PROVIDER_CATALOG = {
  codex: { name: "Codex", iconSlug: "codex" },
  openai: { name: "OpenAI", iconSlug: "codex" },
};
`,
      },
      { id: "codex", iconSlug: "codex", deleteIcon: false, keptIconSlugs: ["codex"] },
    );
    expect(sharedIcon.files["src/providers/catalog.ts"]).toContain('iconSlug: "codex"');
    expect(sharedIcon.mentions).toEqual([]);
  });

  it("deletes a semicolon-terminated last pace-rule name", () => {
    const result = prune(
      {
        "src/providers/paceCapabilities.ts": `export type PaceCustomId =
  | "claudeSessionAlways"
  | "zaiMonthlyMcp";

export const CUSTOM_WINDOW_RULES = {
  claudeSessionAlways: () => true,
  zaiMonthlyMcp: (window) => window.windowMinutes === 43200,
};

export const PACE_CAPABILITIES = {
  zai: {
    resetWindowPace: { type: "custom", id: "zaiMonthlyMcp" },
  },
};
`,
      },
      "zai",
    );

    expect(result.files["src/providers/paceCapabilities.ts"]).toContain('| "claudeSessionAlways";');
    expect(result.files["src/providers/paceCapabilities.ts"]).not.toContain("zaiMonthlyMcp");
    expect(result.mentions.some((mention) => mention.includes("PaceCustomId"))).toBe(false);
  });

  it("reports a pace-rule name the line match cannot delete", () => {
    const result = prune(
      {
        "src/providers/paceCapabilities.ts": `export type PaceCustomId =
  | "zaiMonthlyMcp"; // last

export const CUSTOM_WINDOW_RULES = {
  zaiMonthlyMcp: (window) => true,
};

export const PACE_CAPABILITIES = {
  zai: {
    resetWindowPace: { type: "custom", id: "zaiMonthlyMcp" },
  },
};
`,
      },
      "zai",
    );

    expect(result.files["src/providers/paceCapabilities.ts"]).toContain('| "zaiMonthlyMcp"; // last');
    expect(result.mentions).toContain(
      "src/providers/paceCapabilities.ts: pace rule zaiMonthlyMcp is still in PaceCustomId",
    );
  });

  it("does not report a shared icon row deleted later in the same batch", () => {
    const files = {
      "src/providers/catalog.ts": `export const PROVIDER_CATALOG = {
  kimi: { name: "Kimi", iconSlug: "kimi" },
  moonshot: { name: "Moonshot", iconSlug: "kimi" },
};
`,
      "src/providers/registry.test.ts": `expect(iconSlug).toBe("kimi");\n`,
    };
    let current = files;
    const synthetic = [];
    for (const id of ["kimi", "moonshot"]) {
      const result = pruneProviderSources(current, {
        id,
        iconSlug: "kimi",
        keptIconSlugs: [],
        deleteIcon: true,
        scan: false,
      });
      current = result.files;
      synthetic.push(...result.mentions);
    }
    const mentions = [
      ...synthetic,
      ...collectProviderMentions(current, "kimi", []),
      ...collectProviderMentions(current, "moonshot", []),
    ];

    expect(current["src/providers/catalog.ts"]).not.toContain("moonshot");
    expect(current["src/providers/catalog.ts"]).not.toContain('name: "Kimi"');
    expect(mentions).toEqual(["src/providers/registry.test.ts:1"]);
  });

  it("leaves an unrelated catalog unchanged", () => {
    const source = `export const PROVIDER_CATALOG = {
  codex: { name: "Codex", iconSlug: "codex" },
} satisfies Record<string, unknown>;
`;
    const result = prune({ "src/providers/catalog.ts": source }, "zoommate");
    expect(result.files["src/providers/catalog.ts"]).toBe(source);
    expect(result.deleted).toEqual([]);
    expect(result.mentions).toEqual([]);
  });
});
