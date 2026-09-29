#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { fetchLatestReleaseTarget, isMainModule, renderUpstreamLock, upstreamLockPath } from "./lib/upstream.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function runNpm(args, env, { capture = false, cwd = ROOT } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", args, {
      cwd,
      env,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    if (capture) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        process.stderr.write(chunk);
      });
    }
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code: code ?? 1, stdout }));
  });
}

export async function readSnapshot(paths, root = ROOT) {
  const snapshot = {};
  for (const relative of paths) {
    try {
      snapshot[relative] = await readFile(path.join(root, relative));
    } catch (error) {
      if (error?.code === "ENOENT") snapshot[relative] = null;
      else throw error;
    }
  }
  return snapshot;
}

const PRUNE_ITERATE = "Iterate with CODEXBAR_DIR and npm run upstream:check.";
const ICONS_NEXT = "SVGs were not written. Run npm run upstream:sync-icons, then bump again.";

// CODEXBAR_DIR is the release only when HEAD is that SHA and the worktree is clean.
export function inspectReleaseCheckout(localDir, expectedSha, exec = execFileSync) {
  let head = "";
  let status = "";
  try {
    head = exec("git", ["-C", localDir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    status = exec("git", ["-C", localDir, "status", "--porcelain"], { encoding: "utf8" });
  } catch (error) {
    const stderr = typeof error?.stderr?.toString === "function" ? error.stderr.toString().trim() : "";
    const detail = stderr || (error instanceof Error ? error.message.split("\n")[0] : String(error));
    return `CODEXBAR_DIR ${localDir} is not a git checkout (${detail}).`;
  }

  const reasons = [];
  if (head.toLowerCase() !== expectedSha.toLowerCase()) {
    reasons.push(`HEAD is ${head}, not release ${expectedSha}`);
  }
  if (status.trim() !== "") {
    reasons.push("git status is not empty");
  }
  if (reasons.length === 0) {
    return null;
  }
  return `CODEXBAR_DIR ${localDir} ${reasons.join("; ")}.`;
}

export async function writeBumpedLock(target, lockPath = upstreamLockPath()) {
  let previous;
  try {
    previous = await readFile(lockPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await writeFile(lockPath, renderUpstreamLock(target, previous), "utf8");
}

export async function restoreSnapshot(snapshot, root = ROOT) {
  for (const [relative, contents] of Object.entries(snapshot)) {
    const target = path.join(root, relative);
    if (contents === null) {
      await rm(target, { force: true });
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
}

export async function runBump(deps) {
  const target = await deps.fetchLatestReleaseTarget();
  deps.log?.(`Checking CodexBar ${target.tag} (${target.sha}) before writing the lockfile.`);
  const env = { ...deps.env, CODEXBAR_REF: target.sha };
  if (env.CODEXBAR_DIR) {
    const reason = await (deps.inspectCheckout ?? inspectReleaseCheckout)(env.CODEXBAR_DIR, target.sha);
    if (reason) {
      deps.stderr?.(reason);
      return 1;
    }
  }

  const planned = await deps.runNpm(["run", "--silent", "upstream:prune", "--", "--plan"], env, { capture: true });
  if (planned.code !== 0) {
    if (planned.stdout) {
      deps.stderr?.(planned.stdout);
    }
    deps.stderr?.(`upstream:prune failed; lockfile not updated. ${PRUNE_ITERATE}`);
    return planned.code || 1;
  }

  const plan = JSON.parse(planned.stdout);
  const paths = [...plan.updates, ...plan.deleted];
  let snapshot;
  if (paths.length > 0) {
    snapshot = await deps.readSnapshot(paths);
    const applied = await deps.runNpm(["run", "upstream:prune"], env);
    if (applied.code !== 0) {
      await deps.restoreSnapshot(snapshot);
      deps.stderr?.(`upstream:prune failed; restored. Lockfile not updated. ${PRUNE_ITERATE}`);
      return applied.code || 1;
    }
  }

  for (const args of [
    ["run", "typecheck"],
    ["test"],
  ]) {
    const result = await deps.runNpm(args, env);
    if (result.code !== 0) {
      if (snapshot) {
        await deps.restoreSnapshot(snapshot);
        deps.stderr?.("typecheck or tests failed; restored the prune. Lockfile not updated.");
      } else {
        deps.stderr?.("typecheck or tests failed. Lockfile not updated.");
      }
      return result.code || 1;
    }
  }

  const check = await deps.runNpm(["run", "upstream:check"], env);
  if (check.code !== 0) {
    deps.stderr?.(
      snapshot
        ? "upstream:check failed. Those edits were kept and the lock was not written."
        : "upstream:check failed; lockfile not updated.",
    );
    return check.code || 1;
  }
  const icons = await deps.runNpm(["run", "upstream:sync-icons", "--", "--check"], env);
  if (icons.code !== 0) {
    deps.stderr?.(`upstream:sync-icons --check failed; lockfile not updated. ${ICONS_NEXT}`);
    return icons.code || 1;
  }

  await deps.writeLock(target);
  deps.log?.(`Wrote ${deps.lockPath ?? "codexbar-upstream.lock"}: ${target.tag} ${target.sha}`);
  return 0;
}

async function bump() {
  const code = await runBump({
    env: process.env,
    fetchLatestReleaseTarget,
    runNpm: (args, env, options) => runNpm(args, env, options),
    readSnapshot: (paths) => readSnapshot(paths),
    restoreSnapshot: (snapshot) => restoreSnapshot(snapshot),
    writeLock: (target) => writeBumpedLock(target),
    lockPath: upstreamLockPath(),
    log: (message) => console.log(message),
    stderr: (message) => console.error(message),
  });
  if (code !== 0) process.exitCode = code;
}

if (isMainModule(import.meta.url)) {
  bump().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
