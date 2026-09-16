import type { ProviderInteractionMode, ProviderSourceMode } from "../providers/types";
import { canForceRefreshViaServe, type CodexBarCapabilities, type ResolvedCodexBarBinary } from "./binary";
import { executeCodexBar } from "./exec";
import { CODEXBAR_SERVE_REQUEST_TIMEOUT_SECONDS, isCodexBarServeAttested, requestCodexBarServeJson } from "./serve";

const CODEXBAR_WEB_TIMEOUT_MS = 5_000;

/**
 * Which CodexBar path answers a usage request.
 * - `auto`: an attested serve daemon when available, otherwise a one-shot `usage` command.
 *   Forced refreshes on CLIs without serve force-refresh go straight to one-shot.
 * - `serve`: only the serve daemon; throws when it is unavailable or unattested.
 * - `one-shot`: only a fresh `usage` command. The only transport that can carry `--status`.
 */
export type UsageTransport = "auto" | "serve" | "one-shot";

export type FetchUsageOptions = {
  transport?: UsageTransport;
  /** Add `--status` to the one-shot command. Implies `transport: "one-shot"`; serve cannot produce status. */
  includeStatus?: boolean;
  mode?: "auto" | "force";
  source?: ProviderSourceMode;
  interaction?: ProviderInteractionMode;
};

/** Fetch one Provider's raw usage payload. Callers normalize; this only talks to the CLI. */
export async function fetchUsage(
  binary: ResolvedCodexBarBinary,
  providerId: string,
  options: FetchUsageOptions = {},
): Promise<unknown> {
  const transport = options.includeStatus ? "one-shot" : (options.transport ?? "auto");
  const usageCommandArgs = buildProviderUsageCommandArgs(providerId, {
    includeStatus: options.includeStatus,
    source: options.source,
    interaction: options.interaction,
    capabilities: binary.capabilities,
  });

  if (transport === "one-shot") {
    return executeCodexBar(binary, usageCommandArgs);
  }

  if (transport === "serve") {
    return executeCodexBarServe(binary, providerId, options);
  }

  // Older CLIs without serve force-refresh always use a fresh one-shot command for forced refreshes.
  if (options.mode === "force" && !canForceRefreshViaServe(binary)) {
    return executeCodexBar(binary, usageCommandArgs);
  }

  try {
    return await executeCodexBarServe(binary, providerId, options);
  } catch {
    // Serve is unavailable, unattested, or this request failed; fall through
    // to a fresh policy-guarded one-shot command.
  }

  // Foreground never starts serve (ADR-0002). When serve is unavailable, a one-shot CLI command
  // bypasses serve's response TTL and remains the negotiated force-refresh fallback.
  return executeCodexBar(binary, usageCommandArgs);
}

async function executeCodexBarServe(
  binary: ResolvedCodexBarBinary,
  providerId: string,
  options: FetchUsageOptions,
): Promise<unknown> {
  if (!(await isCodexBarServeAttested(binary))) {
    throw new Error("CodexBar serve is not attested for the current Keychain access policy.");
  }

  const params = new URLSearchParams({ provider: providerId });
  if (binary.capabilities?.serveAppFetchProfile) {
    params.set("fetchProfile", "app");
  }
  if (binary.capabilities?.interactionModes) {
    params.set("interaction", options.interaction ?? "background");
  }
  if (options.mode === "force") {
    if (!canForceRefreshViaServe(binary)) {
      throw new Error("CodexBar serve cannot force-refresh.");
    }
    params.set("refresh", "true");
  }
  return requestCodexBarServeJson(`/usage?${params.toString()}`, CODEXBAR_SERVE_REQUEST_TIMEOUT_SECONDS * 1000);
}

function buildProviderUsageCommandArgs(
  providerId: string,
  options?: {
    includeStatus?: boolean;
    source?: ProviderSourceMode;
    interaction?: ProviderInteractionMode;
    capabilities?: CodexBarCapabilities;
  },
): string[] {
  const capabilities = options?.capabilities;
  return [
    "usage",
    "--format",
    "json",
    "--json-only",
    "--json-output",
    "--web-timeout",
    `${CODEXBAR_WEB_TIMEOUT_MS / 1000}`,
    ...(options?.includeStatus ? ["--status"] : []),
    ...(capabilities?.appFetchProfile ? ["--fetch-profile", "app"] : []),
    ...(capabilities?.appFetchProfile && capabilities.interactionModes
      ? ["--interaction", options?.interaction ?? "background"]
      : []),
    "--provider",
    providerId,
    "--source",
    options?.source ?? "auto",
  ];
}
