import { describe, expect, it } from "vitest";
import { assertSafeIconSlug, listStaleIconSlugs, optimizeSvg } from "./sync-provider-icons.mjs";

describe("assertSafeIconSlug", () => {
  it("accepts harvested slugs", () => {
    expect(assertSafeIconSlug("codex")).toBe("codex");
    expect(assertSafeIconSlug("openrouter")).toBe("openrouter");
  });

  it("rejects path walk and separators", () => {
    expect(() => assertSafeIconSlug("../x")).toThrow(/Unsafe/);
    expect(() => assertSafeIconSlug("/etc/passwd")).toThrow(/Unsafe/);
    expect(() => assertSafeIconSlug("foo/bar")).toThrow(/Unsafe/);
  });
});

describe("listStaleIconSlugs", () => {
  it("reports svg files whose slug is not in the catalog", () => {
    expect(listStaleIconSlugs(["codex.svg", "crof.svg", "notes.txt"], ["codex"])).toEqual(["crof"]);
  });
});

describe("optimizeSvg", () => {
  it("strips script elements", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><circle cx="5" cy="5" r="4"/></svg>`;
    const out = optimizeSvg(svg, "codex");
    expect(out).not.toMatch(/script/i);
    expect(out).toContain("viewBox=");
  });
});
