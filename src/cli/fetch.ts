import { getMockProviderPayload, isCodexBarMockMode } from "../mocks/codexbar";
import { applyProviderUsageSectionMemory } from "../lib/providerShapeMemory";
import {
  extractProviderErrorMessage,
  extractProviderStatus,
  normalizeProviderDetailPayload,
} from "../providers/normalize";
import { isProviderSelectorId } from "../providers/registry";
import type {
  ProviderDetailData,
  ProviderInteractionMode,
  ProviderSourceMode,
  ProviderStatus,
} from "../providers/types";
import { canForceRefreshViaServe, type CodexBarCapabilities, type ResolvedCodexBarBinary } from "./binary";
import { CodexBarCliError, executeCodexBar } from "./exec";
import { CODEXBAR_SERVE_REQUEST_TIMEOUT_SECONDS, isCodexBarServeAttested, requestCodexBarServeJson } from "./serve";

const CODEXBAR_WEB_TIMEOUT_MS = 5_000;

export type ProviderFetchOptions = {
  mode?: "auto" | "force";
  source?: ProviderSourceMode;
  interaction?: ProviderInteractionMode;
};

export const KEYCHAIN_ACCESS_DISABLED_PROVIDER_ERROR_HINT =
  "Keychain access is disabled. This Provider may require another authentication source.\n\nConfigure it in the CodexBar app or allow Keychain access and retry.";

function appendKeychainAccessPolicyHint(error: unknown, binary: ResolvedCodexBarBinary): Error {
  if (binary.keychainAccessPolicy !== "disabled") {
    return error instanceof Error ? error : new Error(String(error));
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.includes(KEYCHAIN_ACCESS_DISABLED_PROVIDER_ERROR_HINT)) {
    return error instanceof Error ? error : new Error(message);
  }

  const hintedMessage = `${message}\n\n${KEYCHAIN_ACCESS_DISABLED_PROVIDER_ERROR_HINT}`;
  return error instanceof CodexBarCliError
    ? new CodexBarCliError(error.kind, hintedMessage, error.detail)
    : new Error(hintedMessage);
}

async function withProviderFetchErrorHint<T>(binary: ResolvedCodexBarBinary, fetch: () => Promise<T>): Promise<T> {
  try {
    return await fetch();
  } catch (error) {
    throw appendKeychainAccessPolicyHint(error, binary);
  }
}

async function executeCodexBarServe(
  binary: ResolvedCodexBarBinary,
  providerId: string,
  options?: ProviderFetchOptions,
): Promise<unknown> {
  if (!(await isCodexBarServeAttested(binary))) {
    throw new Error("CodexBar serve is not attested for the current Keychain access policy.");
  }

  const params = new URLSearchParams({ provider: providerId });
  if (binary.capabilities?.serveAppFetchProfile) {
    params.set("fetchProfile", "app");
  }
  if (binary.capabilities?.interactionModes) {
    params.set("interaction", options?.interaction ?? "background");
  }
  if (options?.mode === "force") {
    if (!canForceRefreshViaServe(binary)) {
      throw new Error("CodexBar serve cannot force-refresh.");
    }
    params.set("refresh", "true");
  }
  return requestCodexBarServeJson(`/usage?${params.toString()}`, CODEXBAR_SERVE_REQUEST_TIMEOUT_SECONDS * 1000);
}

async function fetchProviderDetailPayload(
  binary: ResolvedCodexBarBinary,
  providerId: string,
  options?: ProviderFetchOptions,
): Promise<unknown> {
  const usageCommandArgs = buildProviderUsageCommandArgs(providerId, {
    source: options?.source,
    interaction: options?.interaction,
    capabilities: binary.capabilities,
  });

  // Older CLIs without serve force-refresh always use a fresh one-shot command for forced refreshes.
  if (options?.mode === "force" && !canForceRefreshViaServe(binary)) {
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

export async function fetchProviderDetail(
  binary: ResolvedCodexBarBinary,
  providerId: string,
  options?: ProviderFetchOptions,
): Promise<ProviderDetailData> {
  const normalizedProviderId = assertFetchableProviderId(providerId);
  return withProviderFetchErrorHint(binary, async () => {
    if (binary.source === "mock" || isCodexBarMockMode()) {
      return withRequestMetadata(
        normalizeProviderDetailPayload(getMockProviderPayload(normalizedProviderId), normalizedProviderId),
        options?.source,
      );
    }

    const payload = await fetchProviderDetailPayload(binary, normalizedProviderId, options);
    // Graft remembered sections (ADR-0007): flaky upstream payloads must not drop meters.
    const detail = applyProviderUsageSectionMemory(
      normalizeProviderDetailResponse(payload, normalizedProviderId),
      binary.keychainAccessPolicy,
    );
    return withRequestMetadata(detail, options?.source);
  });
}

export async function fetchProviderDetailFromServe(
  binary: ResolvedCodexBarBinary,
  providerId: string,
  options?: ProviderFetchOptions,
): Promise<ProviderDetailData> {
  const normalizedProviderId = assertFetchableProviderId(providerId);
  return withProviderFetchErrorHint(binary, async () => {
    if (binary.source === "mock" || isCodexBarMockMode()) {
      return withRequestMetadata(
        normalizeProviderDetailPayload(getMockProviderPayload(normalizedProviderId), normalizedProviderId),
        options?.source,
      );
    }

    const payload = await executeCodexBarServe(binary, normalizedProviderId, options);
    const detail = applyProviderUsageSectionMemory(
      normalizeProviderDetailResponse(payload, normalizedProviderId),
      binary.keychainAccessPolicy,
    );
    return withRequestMetadata(detail, options?.source);
  });
}

export async function fetchProviderDetailFromUsageCommand(
  binary: ResolvedCodexBarBinary,
  providerId: string,
  options?: ProviderFetchOptions,
): Promise<ProviderDetailData> {
  const normalizedProviderId = assertFetchableProviderId(providerId);
  return withProviderFetchErrorHint(binary, async () => {
    if (binary.source === "mock" || isCodexBarMockMode()) {
      return withRequestMetadata(
        normalizeProviderDetailPayload(getMockProviderPayload(normalizedProviderId), normalizedProviderId),
        options?.source,
      );
    }

    const payload = await executeCodexBar(
      binary,
      buildProviderUsageCommandArgs(normalizedProviderId, {
        source: options?.source,
        interaction: options?.interaction,
        capabilities: binary.capabilities,
      }),
    );
    const detail = applyProviderUsageSectionMemory(
      normalizeProviderDetailResponse(payload, normalizedProviderId),
      binary.keychainAccessPolicy,
    );
    return withRequestMetadata(detail, options?.source);
  });
}

export type ProviderUsageWithStatus = {
  detail: ProviderDetailData;
  status?: ProviderStatus;
};

// One-shot usage+status. Used by background refresh when serve is cold.
export async function fetchProviderUsageWithStatus(
  binary: ResolvedCodexBarBinary,
  providerId: string,
  options?: ProviderFetchOptions,
): Promise<ProviderUsageWithStatus> {
  const normalizedProviderId = assertFetchableProviderId(providerId);
  return withProviderFetchErrorHint(binary, async () => {
    if (binary.source === "mock" || isCodexBarMockMode()) {
      const payload = getMockProviderPayload(normalizedProviderId);
      return {
        detail: withRequestMetadata(normalizeProviderDetailPayload(payload, normalizedProviderId), options?.source),
        status: extractProviderStatus(payload, normalizedProviderId),
      };
    }

    const payload = await executeCodexBar(
      binary,
      buildProviderUsageCommandArgs(normalizedProviderId, {
        includeStatus: true,
        source: options?.source,
        interaction: options?.interaction,
        capabilities: binary.capabilities,
      }),
    );
    const status = extractProviderStatus(payload, normalizedProviderId);
    const normalizedDetail = applyProviderUsageSectionMemory(
      normalizeProviderDetailResponse(payload, normalizedProviderId),
      binary.keychainAccessPolicy,
    );
    const detail = withRequestMetadata(normalizedDetail, options?.source);
    return { detail, status };
  });
}

function assertFetchableProviderId(providerId: string): string {
  const normalizedProviderId = providerId.trim();
  if (!normalizedProviderId || isProviderSelectorId(normalizedProviderId)) {
    throw new CodexBarCliError("execution", "Cannot fetch provider detail without an enabled provider id.");
  }

  return normalizedProviderId;
}

function normalizeProviderDetailResponse(payload: unknown, providerId: string): ProviderDetailData {
  const providerError = extractProviderErrorMessage(payload, providerId);
  if (providerError) {
    throw new CodexBarCliError("execution", providerError);
  }

  return normalizeProviderDetailPayload(payload, providerId);
}

function withRequestMetadata(detail: ProviderDetailData, requestedSource?: ProviderSourceMode): ProviderDetailData {
  return { ...detail, requestedSource: requestedSource ?? "auto" };
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
