import { describe, expect, it } from "vitest";
import { pruneProviderSources } from "./lib/prune-provider.mjs";

const knownIds = ["codex", "claude", "kilo", "zoommate", "helmcode"];

function prune(files, id, iconSlug = id) {
  return pruneProviderSources(files, { id, iconSlug, knownIds, deleteIcon: true });
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
    expect(result.files["src/cli/mockPayloads.ts"]).not.toContain("zoommate");
    expect(result.files["src/cli/mockPayloads.ts"]).toContain("function buildGenericProvider");
    expect(result.files["src/cli/mockPayloads.ts"]).not.toContain("function buildZoom");
    expect(result.deleted).toEqual(["assets/provider-icons/zoommate.svg"]);
    expect(result.leftovers).toEqual([]);
  });

  it("removes an exclusive test and leaves a shared sample in place", () => {
    const result = prune({
      "src/providers/registry.test.ts": `describe("provider registry", () => {
  it("resolves the zoommate alias", () => {
    expect(resolveProviderId("zm")).toBe("zoommate");
  });

  it("resolves several aliases", () => {
    expect(resolveProviderId("zm")).toBe("zoommate");
    expect(resolveProviderId("codex")).toBe("codex");
  });
});
`,
    }, "zoommate");

    const test = result.files["src/providers/registry.test.ts"];
    expect(test).not.toContain('toBe("zoommate")');
    expect(test).toContain('toBe("codex")');
    expect(test).not.toContain("resolves the zoommate alias");
    expect(result.leftovers).toEqual([]);
    expect(result.testMentions).toEqual([]);
  });

  it("removes provider rules, the guard that calls them, and helpers only that guard used", () => {
    const result = prune(
      {
        "src/usage/providerRules/codex.ts": `export function applyCodexWeeklySessionCap(sections: unknown[]) {
  return sections;
}
`,
        "src/usage/normalize.ts": `import { applyCodexWeeklySessionCap } from "./providerRules/codex";
import { buildUsageSections } from "./sections";

function capSessions(providerId: string, sections: unknown[]) {
  // Codex weekly-empty caps session.
  if (providerId === "codex") {
    return applyCodexWeeklySessionCap(sections);
  }

  return sections;
}

const rawSections = [
  ...buildUsageSections(),
  ...applyCodexWeeklySessionCap([]),
];
`,
        "src/providers/paceCapabilities.ts": `export type PaceCustomId =
  | "codexSessionRejectsWeeklyMonthly"
  | "claudeSessionAlways";

function codexSessionRejectsWeeklyMonthly(window: unknown): boolean {
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
        "src/providers/registry.ts": `const HOST_ONLY = "only-codex";

export function resolveDashboardUrl(providerId: string) {
  if (providerId === "codex") {
    return HOST_ONLY;
  }
  return "https://example.com";
}
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
      },
      "codex",
    );

    expect(result.files["src/usage/providerRules/codex.ts"]).toBeUndefined();
    expect(result.deleted).toContain("src/usage/providerRules/codex.ts");
    expect(result.files["src/usage/normalize.ts"]).not.toContain("codex");
    expect(result.files["src/usage/normalize.ts"]).not.toContain("Codex weekly-empty");
    expect(result.files["src/usage/normalize.ts"]).not.toContain("applyCodexWeeklySessionCap");
    expect(result.files["src/usage/normalize.ts"]).toContain("return sections;");
    expect(result.files["src/providers/paceCapabilities.ts"]).not.toContain("codexSessionRejectsWeeklyMonthly");
    expect(result.files["src/providers/paceCapabilities.ts"]).toContain("claudeSessionAlways");
    expect(result.files["src/providers/paceCapabilities.ts"]).toContain('new Set(["claude"])');
    expect(result.files["src/providers/registry.ts"]).not.toContain("HOST_ONLY");
    expect(result.files["src/providers/registry.ts"]).toContain("https://example.com");
    expect(result.files["scripts/check-upstream.mjs"]).not.toContain("codex.sessionPaceWindowRule");
    expect(result.files["scripts/check-upstream.mjs"]).toContain("claude.sessionPaceWindowRule");
    expect(result.leftovers).toEqual([]);
  });

  it("rewrites a provider-id ternary to the other branch", () => {
    const result = prune({
      "src/usage/identity.ts": `import { extractKiloPass } from "./providerRules/kilo";

export function formatPlanText(providerId: string, rawPlanText: string) {
  const providerScopedPlanText = providerId === "kilo" ? (extractKiloPass(rawPlanText) ?? rawPlanText) : rawPlanText;
  return providerScopedPlanText;
}
`,
      "src/usage/providerRules/kilo.ts": `export function extractKiloPass(rawPlanText: string) {
  return rawPlanText;
}
`,
    }, "kilo");

    expect(result.files["src/usage/identity.ts"]).toContain(
      "const providerScopedPlanText = rawPlanText;",
    );
    expect(result.files["src/usage/identity.ts"]).not.toContain("extractKiloPass");
    expect(result.files["src/usage/providerRules/kilo.ts"]).toBeUndefined();
    expect(result.leftovers).toEqual([]);
  });

  it("leaves unrelated source unchanged", () => {
    const source = `export const PROVIDER_CATALOG = {
  codex: { name: "Codex", iconSlug: "codex" },
} satisfies Record<string, unknown>;
`;
    const result = prune({ "src/providers/catalog.ts": source }, "zoommate");
    expect(result.files["src/providers/catalog.ts"]).toBe(source);
    expect(result.deleted).toEqual([]);
  });
});
