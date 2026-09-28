import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readSnapshot, restoreSnapshot, runBump } from "./bump-upstream.mjs";

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
  });

  it("skips typecheck and tests when the plan changes nothing", async () => {
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
      "run upstream:check",
      "run upstream:sync-icons -- --check",
    ]);
    expect(harness.writeLock).toHaveBeenCalledWith(target);
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
