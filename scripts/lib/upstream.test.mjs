import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertSafeUpstreamRef,
  encodeRefForUrl,
  githubRateLimitHint,
  githubTokenFromEnv,
  isMainModule,
  readMenuCardReviewed,
  readUpstreamLock,
  renderUpstreamLock,
  UPSTREAM_LOCK_NOTE,
} from "./upstream.mjs";

describe("assertSafeUpstreamRef", () => {
  it("accepts tags, SHAs, and slashed branch names", () => {
    expect(assertSafeUpstreamRef("v0.55.1")).toBe("v0.55.1");
    expect(assertSafeUpstreamRef("main")).toBe("main");
    expect(assertSafeUpstreamRef("feature/foo")).toBe("feature/foo");
  });

  it("rejects path walk and query/hash injection", () => {
    expect(() => assertSafeUpstreamRef("../../evil/repo/main")).toThrow(/Unsafe/);
    expect(() => assertSafeUpstreamRef("v0.55.1?foo=1")).toThrow(/Unsafe/);
    expect(() => assertSafeUpstreamRef("v0.55.1#x")).toThrow(/Unsafe/);
    expect(() => assertSafeUpstreamRef("https://example.com")).toThrow(/Unsafe/);
  });
});

describe("encodeRefForUrl", () => {
  it("encodes each path segment", () => {
    expect(encodeRefForUrl("v0.55.1")).toBe("v0.55.1");
    expect(encodeRefForUrl("feature/foo")).toBe("feature/foo");
  });
});

describe("isMainModule", () => {
  const moduleUrl = pathToFileURL(path.resolve("/tmp/scripts/check-upstream.mjs")).href;

  it("is true when argv1 resolves to the module URL", () => {
    expect(isMainModule(moduleUrl, "/tmp/scripts/check-upstream.mjs")).toBe(true);
  });

  it("is false when another script is the entry point", () => {
    expect(isMainModule(moduleUrl, "/tmp/scripts/bump-upstream.mjs")).toBe(false);
  });

  it("is false when argv1 is missing", () => {
    expect(isMainModule(moduleUrl, undefined)).toBe(false);
  });
});

describe("github auth", () => {
  it("uses gh auth token when GITHUB_TOKEN is unset", () => {
    expect(githubTokenFromEnv({}, () => "from-gh")).toBe("from-gh");
    expect(githubTokenFromEnv({ GITHUB_TOKEN: "  " }, () => "from-gh")).toBe("from-gh");
    expect(githubTokenFromEnv({ GITHUB_TOKEN: " explicit " }, () => "from-gh")).toBe("explicit");
  });

  it("names GITHUB_TOKEN=$(gh auth token) on a GitHub 403", () => {
    expect(githubRateLimitHint(403, "https://api.github.com/repos/steipete/CodexBar/releases/latest")).toContain(
      "GITHUB_TOKEN=$(gh auth token)",
    );
    expect(githubRateLimitHint(404, "https://api.github.com/repos/steipete/CodexBar")).toBe("");
    expect(githubRateLimitHint(403, "https://example.com/secret")).toBe("");
  });
});

describe("readUpstreamLock", () => {
  const valid = `{
  "repo": "steipete/CodexBar",
  "tag": "v0.55.1",
  "sha": "10587234b54eb6f00efc129566cc25ba744dcc32"
}`;

  it("reads tag and lowercase sha", () => {
    expect(readUpstreamLock(valid)).toEqual({
      repo: "steipete/CodexBar",
      tag: "v0.55.1",
      sha: "10587234b54eb6f00efc129566cc25ba744dcc32",
    });
  });

  it("ignores a note and still returns repo, tag, and sha", () => {
    const rendered = renderUpstreamLock({
      repo: "steipete/CodexBar",
      tag: "v0.55.1",
      sha: "10587234B54EB6F00EFC129566CC25BA744DCC32",
    });
    expect(JSON.parse(rendered).note).toBe(UPSTREAM_LOCK_NOTE);
    expect(readUpstreamLock(rendered)).toEqual({
      repo: "steipete/CodexBar",
      tag: "v0.55.1",
      sha: "10587234b54eb6f00efc129566cc25ba744dcc32",
    });
  });

  it("throws on a missing lockfile-shaped payload", () => {
    expect(() => readUpstreamLock("{}")).toThrow(/repo must be/);
    expect(() => readUpstreamLock('{"repo":"steipete/CodexBar","tag":"v1","sha":"abc"}')).toThrow(/40-character/);
    expect(() => readUpstreamLock("not-json")).toThrow(/valid JSON/);
  });

  it("round-trips menuCardReviewed and still returns only the pin", () => {
    const sha = "10587234B54EB6F00EFC129566CC25BA744DCC32";
    const paths = ["Sources/CodexBar/MenuCardView.swift", "Sources/CodexBarCore/Resources/Plugins/"];
    const rendered = renderUpstreamLock({
      repo: "steipete/CodexBar",
      tag: "v0.55.1",
      sha,
      menuCardReviewed: { sha, paths },
    });
    expect(JSON.parse(rendered).menuCardReviewed).toEqual({ sha: sha.toLowerCase(), paths });
    expect(readUpstreamLock(rendered)).toEqual({
      repo: "steipete/CodexBar",
      tag: "v0.55.1",
      sha: sha.toLowerCase(),
    });
    expect(readMenuCardReviewed(rendered)).toEqual({ sha: sha.toLowerCase(), paths });
    expect(() => readMenuCardReviewed(valid)).toThrow(/missing menuCardReviewed/);
  });

  it("keeps menuCardReviewed from the previous lock when the target omits it", () => {
    const reviewedSha = "a".repeat(40);
    const paths = ["Sources/CodexBar/MenuCardView.swift"];
    const previous = renderUpstreamLock({
      repo: "steipete/CodexBar",
      tag: "v0.55.1",
      sha: "10587234b54eb6f00efc129566cc25ba744dcc32",
      menuCardReviewed: { sha: reviewedSha, paths },
    });
    const nextSha = "b".repeat(40);
    const rendered = renderUpstreamLock(
      {
        repo: "steipete/CodexBar",
        tag: "v0.67.0",
        sha: nextSha,
      },
      previous,
    );
    expect(JSON.parse(rendered).menuCardReviewed).toEqual({ sha: reviewedSha, paths });
    expect(readUpstreamLock(rendered)).toEqual({
      repo: "steipete/CodexBar",
      tag: "v0.67.0",
      sha: nextSha,
    });
    const replaced = renderUpstreamLock(
      {
        repo: "steipete/CodexBar",
        tag: "v0.67.0",
        sha: nextSha,
        menuCardReviewed: { sha: nextSha, paths },
      },
      previous,
    );
    expect(JSON.parse(replaced).menuCardReviewed.sha).toBe(nextSha);
  });
});
