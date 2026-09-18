import { CodexBarCliError } from "../cli/exec";
import type { FetchUsageOptions } from "../cli/fetch";
import { applyProviderUsageSectionMemory } from "../cache/sectionMemory";
import {
  extractProviderErrorMessage,
  extractProviderStatus,
  normalizeProviderDetailPayload,
} from "../providers/normalize";
import { isProviderSelectorId } from "../providers/registry";
import type { ProviderDetailData, ProviderSourceMode, ProviderStatus } from "../providers/types";
import type { CodexBarClient } from "./codexbarClient";

// The one place a raw CodexBar usage payload becomes a ProviderDetailData:
// fetch (any transport) -> reject payload-level errors -> normalize -> graft
// remembered supplemental sections (ADR-0007) -> stamp the requested source.

export type LoadProviderDetailOptions = FetchUsageOptions;

export type ProviderUsageWithStatus = {
  detail: ProviderDetailData;
  /** Only present when `includeStatus` was requested and the payload carried one (ADR-0003). */
  status?: ProviderStatus;
};

export async function loadProviderDetail(
  client: CodexBarClient,
  providerId: string,
  options: LoadProviderDetailOptions = {},
): Promise<ProviderUsageWithStatus> {
  const normalizedProviderId = assertFetchableProviderId(providerId);

  try {
    const payload = await client.fetchUsage(normalizedProviderId, options);
    const detail = withRequestMetadata(
      applyProviderUsageSectionMemory(
        normalizeProviderDetailResponse(payload, normalizedProviderId),
        client.binary.keychainAccessPolicy,
      ),
      options.source,
    );
    const status = options.includeStatus ? extractProviderStatus(payload, normalizedProviderId) : undefined;
    return { detail, status };
  } catch (error) {
    throw appendKeychainAccessPolicyHint(error, client);
  }
}

export const KEYCHAIN_ACCESS_DISABLED_PROVIDER_ERROR_HINT =
  "Keychain access is disabled. This Provider may require another authentication source.\n\nConfigure it in the CodexBar app or allow Keychain access and retry.";

function appendKeychainAccessPolicyHint(error: unknown, client: CodexBarClient): Error {
  if (client.binary.keychainAccessPolicy !== "disabled") {
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
