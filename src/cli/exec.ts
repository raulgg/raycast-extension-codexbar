import { execFile } from "node:child_process";
import { homedir, userInfo } from "node:os";
import { isRecord } from "../usage/json";
import { applyKeychainAccessPolicy, type KeychainAccessPolicy } from "./keychainAccessPolicy";
import type { ResolvedCodexBarBinary } from "./binary";

const CODEXBAR_TIMEOUT_MS = 60_000;

export const MAX_BUFFER_BYTES = 5 * 1024 * 1024;

const DEFAULT_PATH = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";

export type CodexBarCliErrorKind = "unavailable" | "timeout" | "invalid-json" | "execution";

export class CodexBarCliError extends Error {
  kind: CodexBarCliErrorKind;
  detail?: string;

  constructor(kind: CodexBarCliErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "CodexBarCliError";
    this.kind = kind;
    this.detail = detail;
  }
}

type ExecFailure = Error & {
  code?: number | string;
  killed?: boolean;
  signal?: NodeJS.Signals;
  stdout?: string | Buffer;
  stderr?: string | Buffer;
};

type ExecFileOptions = {
  encoding: BufferEncoding;
  timeout: number;
  maxBuffer: number;
  env?: NodeJS.ProcessEnv;
};

export function execFileAsync(
  command: string,
  args: string[],
  options: ExecFileOptions,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

export function buildCodexBarProcessEnv(policy: KeychainAccessPolicy): NodeJS.ProcessEnv {
  const currentUser = userInfo();
  const username = process.env.USER || process.env.LOGNAME || currentUser.username;

  return applyKeychainAccessPolicy(
    {
      ...process.env,
      HOME: process.env.HOME || currentUser.homedir || homedir(),
      USER: username,
      LOGNAME: process.env.LOGNAME || username,
      SHELL: process.env.SHELL || currentUser.shell || "/bin/zsh",
      PATH: process.env.PATH || DEFAULT_PATH,
    },
    policy,
  );
}

function getFailureOutput(error: unknown, key: "stdout" | "stderr"): string {
  const output = (error as ExecFailure | undefined)?.[key];
  if (typeof output === "string") {
    return output;
  }
  if (Buffer.isBuffer(output)) {
    return output.toString("utf8");
  }
  return "";
}

export function extractJsonPayload(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new CodexBarCliError("invalid-json", "CodexBar returned no JSON output.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const objectStart = trimmed.indexOf("{");
    const arrayStart = trimmed.indexOf("[");
    const startCandidates = [objectStart, arrayStart].filter((value) => value >= 0);
    if (startCandidates.length === 0) {
      throw new CodexBarCliError("invalid-json", "CodexBar returned invalid JSON.", trimmed);
    }

    const start = Math.min(...startCandidates);
    const openChar = trimmed[start];
    const closeChar = openChar === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < trimmed.length; index += 1) {
      const char = trimmed[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === openChar) {
        depth += 1;
      } else if (char === closeChar) {
        depth -= 1;
        if (depth === 0) {
          return JSON.parse(trimmed.slice(start, index + 1));
        }
      }
    }
  }

  throw new CodexBarCliError("invalid-json", "CodexBar returned invalid JSON.", trimmed);
}

function getJsonErrorMessage(payload: unknown): string | undefined {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (!isRecord(payload)) {
    return undefined;
  }

  const record = payload;
  const directMessage =
    (typeof record.message === "string" && record.message) ||
    (typeof record.error === "string" && record.error) ||
    (typeof record.detail === "string" && record.detail);
  if (directMessage) {
    return directMessage;
  }

  const nestedError = record.error;
  if (isRecord(nestedError)) {
    if (typeof nestedError.message === "string" && nestedError.message) {
      return nestedError.message;
    }
  }

  return undefined;
}

export function classifyExecFailure(error: unknown): CodexBarCliError {
  const failure = error as ExecFailure | undefined;
  const code = failure?.code === undefined ? "" : String(failure.code);
  const stdout = getFailureOutput(error, "stdout");
  const stderr = getFailureOutput(error, "stderr");
  const combinedDetail = [stdout, stderr].filter(Boolean).join("\n");
  const message = [failure?.message, stderr].filter(Boolean).join("\n");
  const normalized = message.toLowerCase();

  if (
    code === "ENOENT" ||
    code === "EACCES" ||
    normalized.includes("command not found") ||
    (normalized.includes("spawn") && normalized.includes("enoent"))
  ) {
    return new CodexBarCliError("unavailable", "Unable to launch the `codexbar` CLI.", combinedDetail);
  }

  if (code === "ETIMEDOUT" || failure?.killed || failure?.signal === "SIGTERM") {
    return new CodexBarCliError("timeout", "CodexBar timed out while fetching usage data.", combinedDetail);
  }

  return new CodexBarCliError("execution", "CodexBar failed to fetch usage data.", combinedDetail);
}

export async function executeCodexBar(binary: ResolvedCodexBarBinary, args: string[]): Promise<unknown> {
  try {
    const { stdout } = await execFileAsync(binary.command, args, {
      encoding: "utf8",
      timeout: CODEXBAR_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER_BYTES,
      env: buildCodexBarProcessEnv(binary.keychainAccessPolicy),
    });

    return extractJsonPayload(stdout);
  } catch (error) {
    const stdout = getFailureOutput(error, "stdout");
    if (stdout.trim()) {
      const payload = extractJsonPayload(stdout);
      const jsonErrorMessage = getJsonErrorMessage(payload);
      if (!jsonErrorMessage) {
        return payload;
      }

      throw new CodexBarCliError("execution", jsonErrorMessage, getFailureOutput(error, "stderr"));
    }

    throw classifyExecFailure(error);
  }
}
