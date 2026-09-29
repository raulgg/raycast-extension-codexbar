import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { executePrune, planSummary, pruneMode } from "./prune-removed-providers.mjs";
import { planPrune, removeObjectProperties, removeOrderIds } from "./lib/prune-provider.mjs";

function moduleSource(id, iconSlug = id) {
  return `const ${id} = { metadata: { iconSlug: "${iconSlug}" } };\nexport default ${id};\n`;
}

function orderSource(ids) {
  return `export const CATALOG_PROVIDER_ORDER = [\n${ids.map((id) => `  "${id}",`).join("\n")}\n];\n`;
}

function tree(ids, extra = {}) {
  const files = {
    "src/providers/index.ts": "export {}\n",
    "scripts/lib/provider-modules.mjs": orderSource(ids),
    ...extra,
  };
  for (const id of ids) {
    const [providerId, iconSlug] = Array.isArray(id) ? id : [id, id];
    files[`src/providers/${providerId}/index.ts`] = moduleSource(providerId, iconSlug);
  }
  return files;
}

describe("planPrune", () => {
  it("removes a plain Provider directory, the index import, and the order entry", () => {
    const files = tree(["codex", "zoommate"], {
      "src/usage/normalize.ts": "export const untouched = true;\n",
    });
    const result = planPrune(files, [{ id: "zoommate", iconSlug: "zoommate" }]);

    expect(result.ok).toBe(true);
    expect(result.files["src/usage/normalize.ts"]).toBe(files["src/usage/normalize.ts"]);
    expect(result.files["src/providers/codex/index.ts"]).toBe(files["src/providers/codex/index.ts"]);
    expect(result.files["src/providers/zoommate/index.ts"]).toBeUndefined();
    expect(result.files["scripts/lib/provider-modules.mjs"]).not.toContain('"zoommate"');
    expect(result.files["src/providers/index.ts"]).toContain('import codex from "./codex"');
    expect(result.files["src/providers/index.ts"]).not.toContain("zoommate");
    expect(result.deleted).toEqual([
      "assets/provider-icons/zoommate.svg",
      "src/providers/zoommate/index.ts",
    ]);
    expect(result.updates.sort()).toEqual([
      "scripts/lib/provider-modules.mjs",
      "src/providers/index.ts",
    ]);
  });

  it("keeps a shared icon and does not treat the surviving iconSlug as a blocker", () => {
    const files = tree([
      ["codex", "codex"],
      ["openai", "codex"],
    ]);
    const result = planPrune(files, [{ id: "codex", iconSlug: "codex" }]);

    expect(result.ok).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.deleted).not.toContain("assets/provider-icons/codex.svg");
    expect(result.files["src/providers/openai/index.ts"]).toContain('iconSlug: "codex"');
  });

  it("deletes an icon no remaining Provider uses", () => {
    const files = tree(["zoommate"]);
    const result = planPrune(files, [{ id: "zoommate", iconSlug: "zoommate" }]);
    expect(result.deleted).toContain("assets/provider-icons/zoommate.svg");
  });

  it("writes nothing when production code still quotes the id", () => {
    const files = tree(["codex", "zoommate"], {
      "src/usage/normalize.ts": 'export const sample = "zoommate";\n',
      "src/usage/load.ts": 'import zoommate from "../providers/zoommate";\n',
      "src/usage/link.ts": 'const url = "https://example.com/zoommate/settings";\n',
    });
    const removed = [{ id: "zoommate", iconSlug: "zoommate" }];
    const result = planPrune(files, removed);

    expect(result.ok).toBe(false);
    expect(result.files).toBe(files);
    expect(result.updates).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(result.blockers).toEqual([
      "src/usage/link.ts:1: zoommate",
      "src/usage/load.ts:1: zoommate",
      "src/usage/normalize.ts:1: zoommate",
    ]);
    expect(planPrune(files, removed).blockers).toEqual(result.blockers);
  });

  it("writes nothing when an allowlist object cannot be parsed", () => {
    const files = tree(["codex", "zoommate"], {
      "scripts/check-upstream.mjs": "const ALLOWED_DIVERGENCES = { zoommate: {\n",
    });
    const result = planPrune(files, [{ id: "zoommate", iconSlug: "zoommate" }]);
    expect(result.ok).toBe(false);
    expect(result.files).toBe(files);
    expect(result.updates).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(result.blockers[0]).toMatch(/Unterminated/);
  });

  it("scans leftovers after every Provider in the batch is removed", () => {
    const files = tree(["codex", "claude", "zoommate"], {
      "src/keep.ts": 'export const ids = ["zoommate", "claude"];\n',
    });
    files["src/providers/claude/index.ts"] = `${moduleSource("claude")}export const other = "zoommate";\n`;
    const result = planPrune(files, [
      { id: "zoommate", iconSlug: "zoommate" },
      { id: "claude", iconSlug: "claude" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.blockers).toEqual(["src/keep.ts:1: claude", "src/keep.ts:1: zoommate"]);
    expect(result.blockers.join("\n")).not.toContain("src/providers/claude");
  });

  it("reports a test mention and leaves the test file in place", () => {
    const files = tree(["codex", "zoommate"], {
      "src/providers/registry.test.ts": 'expect("zoommate").toBe("zoommate");\n',
    });
    const result = planPrune(files, [{ id: "zoommate", iconSlug: "zoommate" }]);
    expect(result.ok).toBe(true);
    expect(result.testMentions).toEqual(["src/providers/registry.test.ts:1: zoommate"]);
    expect(result.files["src/providers/registry.test.ts"]).toBe(files["src/providers/registry.test.ts"]);
  });

  it("ignores version text, HTML escapes, identifiers, and alias keys", () => {
    const files = tree(["codex", "amp", "cursor", "alibaba", "v0"], {
      "src/usage/lookalikes.ts": [
        'const version = "v0.55.1";',
        'const html = "&amp;";',
        "const cursor = 1;",
        'const alias = "alibaba-token-plan";',
        "",
      ].join("\n"),
    });
    delete files["src/providers/index.ts"];
    const result = planPrune(files, [
      { id: "v0", iconSlug: "v0" },
      { id: "amp", iconSlug: "amp" },
      { id: "cursor", iconSlug: "cursor" },
      { id: "alibaba", iconSlug: "alibaba" },
    ]);
    expect(result.ok).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("drops a pace allowlist key whose fingerprint contains braces", () => {
    const source = readFileSync(new URL("./check-upstream.mjs", import.meta.url), "utf8");
    const next = removeObjectProperties(
      source,
      "CUSTOM_PACE_RULES",
      (key) => key === "codex.sessionPaceWindowRule",
    );
    expect(next).not.toContain('"codex.sessionPaceWindowRule"');
    expect(next).toContain('"claude.sessionPaceWindowRule"');
    expect(next).toContain("window.windowMinutes");
    const head = next.slice(0, next.indexOf("const CUSTOM_PACE_RULES"));
    expect(head).toContain("upstream:prune removes an id only when CodexBar no longer ships that Provider.");
  });

  it("keeps a comment above a hand-maintained list when it drops an id", () => {
    const note = `// Hand-edited list. upstream:prune removes an id only when CodexBar no longer ships that Provider.
`;
    const order = `${note}export const CATALOG_PROVIDER_ORDER = [\n  "codex",\n  "zoommate",\n];\n`;
    const nextOrder = removeOrderIds(order, ["zoommate"]);
    expect(nextOrder.startsWith(note)).toBe(true);
    expect(nextOrder).toContain('"codex"');
    expect(nextOrder).not.toContain("zoommate");

    const object = `${note}const ALLOWED_DIVERGENCES = {\n  zoommate: { reason: "x" },\n  codex: { reason: "y" },\n};\n`;
    const nextObject = removeObjectProperties(object, "ALLOWED_DIVERGENCES", (key) => key === "zoommate");
    expect(nextObject.startsWith(note)).toBe(true);
    expect(nextObject).toContain("codex");
    expect(nextObject).not.toContain("zoommate");
  });
});

describe("upstream:prune modes", () => {
  it("parses check and plan flags", () => {
    expect(pruneMode(["--check"])).toBe("check");
    expect(pruneMode(["--plan"])).toBe("plan");
    expect(pruneMode([])).toBe("apply");
  });

  it("--check writes nothing", async () => {
    const files = tree(["codex", "zoommate"]);
    const writeFile = vi.fn();
    const remove = vi.fn();
    const result = await executePrune({
      mode: "check",
      files,
      removed: [{ id: "zoommate", iconSlug: "zoommate" }],
      writeFile,
      remove,
    });
    expect(result.wrote).toBe(false);
    expect(writeFile).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(result.plan.ok).toBe(true);
  });

  it("--plan prints JSON and writes nothing", async () => {
    const files = tree(["codex", "zoommate"]);
    const writeFile = vi.fn();
    const result = await executePrune({
      mode: "plan",
      files,
      removed: [{ id: "zoommate", iconSlug: "zoommate" }],
      writeFile,
      remove: vi.fn(),
    });
    expect(result.wrote).toBe(false);
    expect(writeFile).not.toHaveBeenCalled();
    expect(JSON.parse(result.stdout)).toEqual(planSummary(result.plan));
  });
});
