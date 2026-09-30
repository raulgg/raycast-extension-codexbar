import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectReleaseCheckout, readSnapshot, restoreSnapshot, runBump, writeBumpedLock } from "./bump-upstream.mjs";

const target = { tag: "v0.67.0", sha: "abc123" };
const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function deps(runNpm) {
  return {
    env: {},
    fetchLatestReleaseTarget: async () => target,
    runNpm,
    readSnapshot: vi.fn(async () => ({ "src/providers/zoommate/index.ts": Buffer.from("old") })),
    restoreSnapshot: vi.fn(async () => {}),
    writeLock: vi.fn(async () => {}),
    stderr: vi.fn(),
    log: vi.fn(),
  };
}

describe("runBump", () => {
  it("does not write the lock when the prune plan is blocked", async () => {
    const calls = [];
    const harness = deps(async (args) => {
      calls.push(args.join(" "));
      return { code: 1, stdout: '{"ok":false,"blockers":["src/keep.ts:1"]}\n' };
    });
    const code = await runBump(harness);
    expect(code).toBe(1);
    expect(calls).toEqual(["run --silent upstream:prune -- --plan"]);
    expect(harness.writeLock).not.toHaveBeenCalled();
    expect(harness.restoreSnapshot).not.toHaveBeenCalled();
    expect(harness.stderr).toHaveBeenCalledWith(
      expect.stringContaining("Iterate with CODEXBAR_DIR and npm run upstream:check."),
    );
  });

  it("runs typecheck and tests before the lock when the plan changes nothing", async () => {
    const calls = [];
    const harness = deps(async (args) => {
      calls.push(args.join(" "));
      if (args.includes("--plan")) {
        return { code: 0, stdout: '{"ok":true,"updates":[],"deleted":[],"blockers":[],"testMentions":[]}\n' };
      }
      return { code: 0, stdout: "" };
    });
    expect(await runBump(harness)).toBe(0);
    expect(calls).toEqual([
      "run --silent upstream:prune -- --plan",
      "run typecheck",
      "test",
      "run upstream:check",
      "run upstream:sync-icons -- --check",
    ]);
    expect(harness.writeLock).toHaveBeenCalledWith(target);
    expect(harness.restoreSnapshot).not.toHaveBeenCalled();
  });

  it("withholds the lock when typecheck fails and the plan is empty", async () => {
    const calls = [];
    const harness = deps(async (args) => {
      calls.push(args.join(" "));
      if (args.includes("--plan")) {
        return { code: 0, stdout: '{"ok":true,"updates":[],"deleted":[],"blockers":[],"testMentions":[]}\n' };
      }
      if (args.includes("typecheck")) return { code: 2, stdout: "" };
      return { code: 0, stdout: "" };
    });
    expect(await runBump(harness)).toBe(2);
    expect(calls).toEqual(["run --silent upstream:prune -- --plan", "run typecheck"]);
    expect(harness.restoreSnapshot).not.toHaveBeenCalled();
    expect(harness.writeLock).not.toHaveBeenCalled();
    expect(harness.stderr).toHaveBeenCalledWith("typecheck or tests failed. Lockfile not updated.");
  });

  it("restores the snapshot when applying the prune fails", async () => {
    const calls = [];
    const harness = deps(async (args) => {
      calls.push(args.join(" "));
      if (args.includes("--plan")) {
        return {
          code: 0,
          stdout: '{"ok":true,"updates":["src/providers/index.ts"],"deleted":[],"blockers":[],"testMentions":[]}\n',
        };
      }
      return { code: 1, stdout: "" };
    });
    expect(await runBump(harness)).toBe(1);
    expect(calls).toEqual(["run --silent upstream:prune -- --plan", "run upstream:prune"]);
    expect(harness.restoreSnapshot).toHaveBeenCalledTimes(1);
    expect(harness.writeLock).not.toHaveBeenCalled();
    expect(harness.stderr).toHaveBeenCalledWith(
      "upstream:prune failed; restored. Lockfile not updated. Iterate with CODEXBAR_DIR and npm run upstream:check.",
    );
  });

  it("restores the snapshot when typecheck fails and does not write the lock", async () => {
    const calls = [];
    const harness = deps(async (args) => {
      calls.push(args.join(" "));
      if (args.includes("--plan")) {
        return {
          code: 0,
          stdout: '{"ok":true,"updates":["src/providers/index.ts"],"deleted":["src/providers/zoommate/index.ts"],"blockers":[],"testMentions":[]}\n',
        };
      }
      if (args.includes("typecheck")) return { code: 2, stdout: "" };
      return { code: 0, stdout: "" };
    });
    expect(await runBump(harness)).toBe(2);
    expect(calls).toContain("run typecheck");
    expect(calls).not.toContain("test");
    expect(harness.restoreSnapshot).toHaveBeenCalledTimes(1);
    expect(harness.writeLock).not.toHaveBeenCalled();
  });

  it("keeps a typechecked prune when upstream:check fails", async () => {
    const harness = deps(async (args) => {
      if (args.includes("--plan")) {
        return {
          code: 0,
          stdout: '{"ok":true,"updates":["src/providers/index.ts"],"deleted":[],"blockers":[],"testMentions":[]}\n',
        };
      }
      if (args.includes("upstream:check")) return { code: 1, stdout: "" };
      return { code: 0, stdout: "" };
    });
    expect(await runBump(harness)).toBe(1);
    expect(harness.restoreSnapshot).not.toHaveBeenCalled();
    expect(harness.writeLock).not.toHaveBeenCalled();
    expect(harness.stderr).toHaveBeenCalledWith(
      "upstream:check failed. Those edits were kept and the lock was not written.",
    );
  });

  it("names the icon sync when --check fails and writes no lock", async () => {
    const harness = deps(async (args) => {
      if (args.includes("--plan")) {
        return { code: 0, stdout: '{"ok":true,"updates":[],"deleted":[],"blockers":[],"testMentions":[]}\n' };
      }
      if (args.includes("--check")) return { code: 1, stdout: "" };
      return { code: 0, stdout: "" };
    });
    expect(await runBump(harness)).toBe(1);
    expect(harness.writeLock).not.toHaveBeenCalled();
    expect(harness.stderr).toHaveBeenCalledWith(
      expect.stringContaining("SVGs were not written. Run npm run upstream:sync-icons, then bump again."),
    );
  });

  it("keeps a clean CODEXBAR_DIR and refuses one that is not the release", async () => {
    const seen = [];
    const harness = deps(async (args, env) => {
      seen.push(env.CODEXBAR_DIR);
      if (args.includes("--plan")) {
        return { code: 0, stdout: '{"ok":true,"updates":[],"deleted":[],"blockers":[],"testMentions":[]}\n' };
      }
      return { code: 0, stdout: "" };
    });
    harness.env = { CODEXBAR_DIR: "/tmp/codexbar-release" };
    harness.inspectCheckout = vi.fn(async () => "CODEXBAR_DIR /tmp/codexbar-release git status is not empty.");
    expect(await runBump(harness)).toBe(1);
    expect(seen).toEqual([]);
    expect(harness.writeLock).not.toHaveBeenCalled();
    expect(harness.stderr).toHaveBeenCalledWith("CODEXBAR_DIR /tmp/codexbar-release git status is not empty.");

    harness.inspectCheckout = vi.fn(async (dir, sha) => {
      expect(dir).toBe("/tmp/codexbar-release");
      expect(sha).toBe(target.sha);
      return null;
    });
    expect(await runBump(harness)).toBe(0);
    expect(seen.every((dir) => dir === "/tmp/codexbar-release")).toBe(true);
    expect(harness.writeLock).toHaveBeenCalledWith(target);
  });
});

describe("inspectReleaseCheckout", () => {
  it("accepts a clean checkout at the release sha and rejects a dirty tree", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "bump-checkout-"));
    roots.push(root);
    execFileSync("git", ["init", "-b", "main", root], { stdio: "ignore" });
    await writeFile(path.join(root, "file"), "a");
    execFileSync("git", ["-C", root, "add", "file"]);
    execFileSync(
      "git",
      ["-C", root, "-c", "commit.gpgsign=false", "-c", "user.email=test@example.com", "-c", "user.name=test", "commit", "-m", "init"],
      { stdio: "ignore" },
    );
    const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    expect(inspectReleaseCheckout(root, head)).toBeNull();
    expect(inspectReleaseCheckout(root, "a".repeat(40))).toContain(`HEAD is ${head}, not release ${"a".repeat(40)}`);
    await writeFile(path.join(root, "file"), "b");
    expect(inspectReleaseCheckout(root, head)).toContain("git status is not empty");
    expect(inspectReleaseCheckout(root, "b".repeat(40))).toContain("git status is not empty");
  });
});

describe("writeBumpedLock", () => {
  it("keeps menuCardReviewed when the lock is rewritten", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "bump-lock-"));
    roots.push(root);
    const lockPath = path.join(root, "codexbar-upstream.lock");
    const reviewed = {
      sha: "a".repeat(40),
      paths: ["Sources/CodexBar/MenuCardView.swift", "Sources/CodexBarCore/Resources/Plugins/"],
    };
    await writeFile(
      lockPath,
      `${JSON.stringify(
        {
          note: "old",
          repo: "steipete/CodexBar",
          tag: "v0.55.1",
          sha: "10587234b54eb6f00efc129566cc25ba744dcc32",
          menuCardReviewed: reviewed,
        },
        null,
        2,
      )}\n`,
    );
    const nextSha = "b".repeat(40);
    await writeBumpedLock(
      {
        repo: "steipete/CodexBar",
        tag: "v0.67.0",
        sha: nextSha,
      },
      lockPath,
    );
    const written = JSON.parse(await readFile(lockPath, "utf8"));
    expect(written.tag).toBe("v0.67.0");
    expect(written.sha).toBe(nextSha);
    expect(written.menuCardReviewed).toEqual(reviewed);
  });
});

describe("restoreSnapshot", () => {
  it("puts back replaced and deleted files and removes files the plan created", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "prune-restore-"));
    roots.push(root);
    await writeFile(path.join(root, "kept.ts"), "new");
    await writeFile(path.join(root, "created.ts"), "fresh");
    const snapshot = {
      "kept.ts": Buffer.from("old"),
      "deleted.ts": Buffer.from("was here"),
      "created.ts": null,
    };
    await restoreSnapshot(snapshot, root);
    expect(await readFile(path.join(root, "kept.ts"), "utf8")).toBe("old");
    expect(await readFile(path.join(root, "deleted.ts"), "utf8")).toBe("was here");
    await expect(readFile(path.join(root, "created.ts"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("reads a missing path as null", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "prune-snapshot-"));
    roots.push(root);
    await expect(readSnapshot(["missing.ts"], root)).resolves.toEqual({ "missing.ts": null });
  });
});
