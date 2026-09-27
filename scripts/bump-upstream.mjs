#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { fetchLatestReleaseTarget, isMainModule, upstreamLockPath } from "./lib/upstream.mjs";

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
  delete env.CODEXBAR_DIR;

  const planned = await deps.runNpm(["run", "--silent", "upstream:prune", "--", "--plan"], env, { capture: true });
  if (planned.code !== 0) {
    deps.stderr?.(planned.stdout);
    deps.stderr?.("upstream:prune failed; lockfile not updated.");
    return planned.code || 1;
  }

  const plan = JSON.parse(planned.stdout);
  const paths = [...plan.updates, ...plan.deleted];
  if (paths.length > 0) {
    const snapshot = await deps.readSnapshot(paths);
    const applied = await deps.runNpm(["run", "upstream:prune"], env);
    if (applied.code !== 0) {
      await deps.restoreSnapshot(snapshot);
      deps.stderr?.("upstream:prune failed; restored. Lockfile not updated.");
      return applied.code || 1;
    }
    for (const args of [
      ["run", "typecheck"],
      ["test"],
    ]) {
      const result = await deps.runNpm(args, env);
      if (result.code !== 0) {
        await deps.restoreSnapshot(snapshot);
        deps.stderr?.("typecheck or tests failed; restored the prune. Lockfile not updated.");
        return result.code || 1;
      }
    }
  }

  const check = await deps.runNpm(["run", "upstream:check"], env);
  if (check.code !== 0) {
    deps.stderr?.("upstream:check failed; lockfile not updated.");
    return check.code || 1;
  }
  const icons = await deps.runNpm(["run", "upstream:sync-icons", "--", "--check"], env);
  if (icons.code !== 0) {
    deps.stderr?.("upstream:sync-icons --check failed; lockfile not updated.");
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
    writeLock: async (target) => {
      await writeFile(upstreamLockPath(), `${JSON.stringify(target, null, 2)}\n`, "utf8");
    },
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
