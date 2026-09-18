import { stat } from "node:fs/promises";
import { request } from "node:http";
import { spawn } from "node:child_process";
import { isRecord } from "../usage/json";
import type { ResolvedCodexBarBinary } from "./binary";
import { CodexBarCliError, buildCodexBarProcessEnv, execFileAsync, MAX_BUFFER_BYTES } from "./exec";
import {
  clearCodexBarServeRuntime,
  codexBarServeRuntimeMatches,
  readCodexBarServeRuntime,
  recordCodexBarServeRuntime,
  type CodexBarServeProcessIdentity,
} from "./serveState";

const CODEXBAR_SERVE_HOST = "127.0.0.1";

const CODEXBAR_SERVE_PORT = 17_653;

const CODEXBAR_SERVE_REFRESH_INTERVAL_SECONDS = 600;

export const CODEXBAR_SERVE_REQUEST_TIMEOUT_SECONDS = 30;

const CODEXBAR_SERVE_HEALTH_TIMEOUT_MS = 500;

const CODEXBAR_SERVE_STARTUP_TIMEOUT_MS = 1_500;

const CODEXBAR_SERVE_STARTUP_POLL_MS = 150;

export function requestCodexBarServeJson(path: string, timeout: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const req = request(
      {
        hostname: CODEXBAR_SERVE_HOST,
        port: CODEXBAR_SERVE_PORT,
        path,
        method: "GET",
        timeout,
      },
      (res) => {
        res.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buffer.byteLength;
          if (totalBytes > MAX_BUFFER_BYTES) {
            req.destroy(new Error("CodexBar serve returned too much data."));
            return;
          }

          chunks.push(buffer);
        });
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`CodexBar serve returned HTTP ${res.statusCode ?? "unknown"}.`));
            return;
          }

          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new CodexBarCliError("invalid-json", "CodexBar serve returned invalid JSON."));
          }
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new CodexBarCliError("timeout", "CodexBar serve request timed out."));
    });
    req.on("error", reject);
    req.end();
  });
}

export async function isCodexBarServeHealthy(): Promise<boolean> {
  try {
    const payload = await requestCodexBarServeJson("/health", CODEXBAR_SERVE_HEALTH_TIMEOUT_MS);
    return isRecord(payload) && payload.status === "ok";
  } catch {
    return false;
  }
}

function startCodexBarServe(binary: ResolvedCodexBarBinary, onError: (error: Error) => void): number | undefined {
  const child = spawn(
    binary.command,
    [
      "serve",
      "--port",
      String(CODEXBAR_SERVE_PORT),
      "--refresh-interval",
      String(CODEXBAR_SERVE_REFRESH_INTERVAL_SECONDS),
      "--request-timeout",
      String(CODEXBAR_SERVE_REQUEST_TIMEOUT_SECONDS),
    ],
    {
      detached: true,
      stdio: "ignore",
      env: buildCodexBarProcessEnv(binary.keychainAccessPolicy),
    },
  );
  child.once("error", onError);
  child.unref();
  return child.pid;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const SERVE_PROBE_TIMEOUT_MS = 5_000;

const SERVE_PROBE_MAX_BUFFER = 64 * 1024;

async function findCodexBarServePid(): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync("lsof", ["-nP", "-ti", `tcp:${CODEXBAR_SERVE_PORT}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      timeout: SERVE_PROBE_TIMEOUT_MS,
      maxBuffer: SERVE_PROBE_MAX_BUFFER,
    });
    const pid = Number.parseInt(stdout.trim().split("\n")[0] ?? "", 10);
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

// ps etime formats: "mm:ss", "hh:mm:ss", "dd-hh:mm:ss".

// ps etime formats: "mm:ss", "hh:mm:ss", "dd-hh:mm:ss".
export function parseProcessElapsedMs(etime: string): number | undefined {
  const match = /^(?:(\d+)-)?(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(etime.trim());
  if (!match) {
    return undefined;
  }

  const [, days, hours, minutes, seconds] = match;
  const totalSeconds =
    Number.parseInt(days ?? "0", 10) * 24 * 60 * 60 +
    Number.parseInt(hours ?? "0", 10) * 60 * 60 +
    Number.parseInt(minutes, 10) * 60 +
    Number.parseInt(seconds, 10);
  return totalSeconds * 1000;
}

async function readProcessElapsedAndCommand(pid: number): Promise<{ elapsedMs: number; command: string } | undefined> {
  try {
    const { stdout } = await execFileAsync("ps", ["-o", "etime=,comm=", "-p", String(pid)], {
      encoding: "utf8",
      timeout: SERVE_PROBE_TIMEOUT_MS,
      maxBuffer: SERVE_PROBE_MAX_BUFFER,
    });
    const line = stdout.trim().split("\n")[0]?.trim();
    const spaceIndex = line?.indexOf(" ") ?? -1;
    if (!line || spaceIndex < 0) {
      return undefined;
    }

    const elapsedMs = parseProcessElapsedMs(line.slice(0, spaceIndex));
    const command = line.slice(spaceIndex + 1).trim();
    if (elapsedMs === undefined || !command) {
      return undefined;
    }

    return { elapsedMs, command };
  } catch {
    return undefined;
  }
}

async function readCodexBarServeProcessIdentity(now = Date.now()): Promise<CodexBarServeProcessIdentity | undefined> {
  const pid = await findCodexBarServePid();
  if (pid === undefined) {
    return undefined;
  }

  const processInfo = await readProcessElapsedAndCommand(pid);
  if (!processInfo) {
    return undefined;
  }

  return {
    pid,
    command: processInfo.command,
    startedAtMs: now - processInfo.elapsedMs,
  };
}

function isRecognizableCodexBarServe(processIdentity: CodexBarServeProcessIdentity): boolean {
  return processIdentity.command.toLowerCase().includes("codexbar");
}

// ADR-0006: a serve daemon started before the CLI binary was last replaced keeps
// serving the old version's payload shapes until restarted.

// ADR-0006: a serve daemon started before the CLI binary was last replaced keeps
// serving the old version's payload shapes until restarted.
async function isCodexBarServeStale(
  binary: ResolvedCodexBarBinary,
  processIdentity: CodexBarServeProcessIdentity,
): Promise<boolean> {
  try {
    // stat follows symlinks, so a Homebrew symlink into the app bundle reports
    // the real helper binary's mtime.
    const { mtimeMs } = await stat(binary.command);
    return mtimeMs > processIdentity.startedAtMs;
  } catch {
    return false;
  }
}

export async function isCodexBarServeAttested(binary: ResolvedCodexBarBinary): Promise<boolean> {
  if (!(await isCodexBarServeHealthy())) {
    clearCodexBarServeRuntime();
    return false;
  }

  const [record, processIdentity] = [readCodexBarServeRuntime(), await readCodexBarServeProcessIdentity()];
  if (!record || !processIdentity || !isRecognizableCodexBarServe(processIdentity)) {
    clearCodexBarServeRuntime();
    return false;
  }

  if (!codexBarServeRuntimeMatches(record, processIdentity, binary.keychainAccessPolicy)) {
    return false;
  }

  return true;
}

async function stopCodexBarServe(pid: number): Promise<boolean> {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return false;
  }

  const deadline = Date.now() + CODEXBAR_SERVE_STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if ((await findCodexBarServePid()) !== pid) {
      return true;
    }

    await sleep(CODEXBAR_SERVE_STARTUP_POLL_MS);
  }

  return (await findCodexBarServePid()) !== pid;
}

export async function ensureCodexBarServe(binary: ResolvedCodexBarBinary): Promise<boolean> {
  const healthy = await isCodexBarServeHealthy();
  const processIdentity = await readCodexBarServeProcessIdentity();

  if (processIdentity && !isRecognizableCodexBarServe(processIdentity)) {
    clearCodexBarServeRuntime();
    return false;
  }

  if (healthy && processIdentity) {
    const record = readCodexBarServeRuntime();
    const policyMatches =
      record !== undefined && codexBarServeRuntimeMatches(record, processIdentity, binary.keychainAccessPolicy);
    const stale = await isCodexBarServeStale(binary, processIdentity);
    if (policyMatches && !stale) {
      return true;
    }
  }

  if (processIdentity) {
    if (!(await stopCodexBarServe(processIdentity.pid))) {
      clearCodexBarServeRuntime();
      return false;
    }
    clearCodexBarServeRuntime();
  } else if (healthy) {
    // A healthy listener whose process identity cannot be verified is never
    // stopped or used. Foreground/background callers fall back to one-shot.
    clearCodexBarServeRuntime();
    return false;
  }

  let serveStartupFailed = false;
  let startedPid: number | undefined;
  try {
    startedPid = startCodexBarServe(binary, () => {
      serveStartupFailed = true;
    });
  } catch {
    return false;
  }
  if (startedPid === undefined) {
    return false;
  }

  const deadline = Date.now() + CODEXBAR_SERVE_STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (serveStartupFailed) {
      return false;
    }

    if (await isCodexBarServeHealthy()) {
      const startedProcessIdentity = await readCodexBarServeProcessIdentity();
      if (
        !startedProcessIdentity ||
        startedProcessIdentity.pid !== startedPid ||
        !isRecognizableCodexBarServe(startedProcessIdentity)
      ) {
        return false;
      }

      recordCodexBarServeRuntime(startedProcessIdentity, binary.keychainAccessPolicy);
      return true;
    }

    await sleep(CODEXBAR_SERVE_STARTUP_POLL_MS);
  }

  return false;
}
