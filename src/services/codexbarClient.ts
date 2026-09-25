import { getCodexBarAvailability, type CodexBarAvailability, type ResolvedCodexBarBinary } from "../cli/binary";
import {
  fetchProviderDetail,
  fetchProviderDetailFromServe,
  fetchProviderDetailFromUsageCommand,
  fetchProviderUsageWithStatus,
  withRequestMetadata,
  type ProviderFetchOptions,
  type ProviderUsageWithStatus,
} from "../cli/fetch";
import type { KeychainAccessPolicy } from "../cli/keychainAccessPolicy";
import {
  getMockAvailableProviders,
  getMockConfiguredProviders,
  getMockProviderPayload,
  isCodexBarMockMode,
} from "../cli/mockPayloads";
import { ensureCodexBarServe } from "../cli/serve";
import {
  listAvailableProviders,
  moveConfiguredProviderInConfig,
  readConfiguredProvidersFromConfig,
  setProviderEnabled,
  type ProviderMoveDirection,
} from "../lib/providerConfig";
import { extractProviderStatus, normalizeProviderDetailPayload } from "../providers/normalize";
import type { AvailableProvider, ConfiguredProvider, ProviderDetailData } from "../providers/types";

// Everything the extension asks of a CodexBar installation, behind one object.
// The real client wraps the CLI process boundary and the shared config file;
// the mock client (development builds with DEV_MOCK) answers from fixtures.
// Callers never branch on mock mode themselves: the choice is made once, in
// getCodexBarClientAvailability.
export type CodexBarClient = {
  readonly binary: ResolvedCodexBarBinary;
  readConfiguredProviders(): Promise<ConfiguredProvider[]>;
  listAvailableProviders(): Promise<AvailableProvider[]>;
  setProviderEnabled(cliProvider: string, enabled: boolean): Promise<void>;
  /** Resolves false when nothing moved (already at the edge, or unknown id). */
  moveConfiguredProvider(providerId: string, direction: ProviderMoveDirection): Promise<boolean>;
  /** Background refresh only (ADR-0002). Resolves true when a healthy, attested serve is available. */
  ensureServe(): Promise<boolean>;
  fetchProviderDetail(providerId: string, options?: ProviderFetchOptions): Promise<ProviderDetailData>;
  fetchProviderDetailFromServe(providerId: string, options?: ProviderFetchOptions): Promise<ProviderDetailData>;
  fetchProviderDetailFromUsageCommand(providerId: string, options?: ProviderFetchOptions): Promise<ProviderDetailData>;
  fetchProviderUsageWithStatus(providerId: string, options?: ProviderFetchOptions): Promise<ProviderUsageWithStatus>;
};

export type CodexBarClientAvailability =
  { status: "available"; client: CodexBarClient } | Exclude<CodexBarAvailability, { status: "available" }>;

export async function getCodexBarClientAvailability(
  keychainAccessPolicy: KeychainAccessPolicy,
): Promise<CodexBarClientAvailability> {
  if (isCodexBarMockMode()) {
    return { status: "available", client: createMockCodexBarClient(keychainAccessPolicy) };
  }

  const availability = await getCodexBarAvailability(keychainAccessPolicy);
  if (availability.status !== "available") {
    return availability;
  }

  return { status: "available", client: createCodexBarClient(availability.binary) };
}

export function createCodexBarClient(binary: ResolvedCodexBarBinary): CodexBarClient {
  return {
    binary,
    readConfiguredProviders: () => readConfiguredProvidersFromConfig(),
    listAvailableProviders: () => listAvailableProviders(binary),
    setProviderEnabled: (cliProvider, enabled) => setProviderEnabled(binary, cliProvider, enabled),
    moveConfiguredProvider: (providerId, direction) => moveConfiguredProviderInConfig(providerId, direction),
    ensureServe: () => ensureCodexBarServe(binary),
    fetchProviderDetail: (providerId, options) => fetchProviderDetail(binary, providerId, options),
    fetchProviderDetailFromServe: (providerId, options) => fetchProviderDetailFromServe(binary, providerId, options),
    fetchProviderDetailFromUsageCommand: (providerId, options) =>
      fetchProviderDetailFromUsageCommand(binary, providerId, options),
    fetchProviderUsageWithStatus: (providerId, options) => fetchProviderUsageWithStatus(binary, providerId, options),
  };
}

export function createMockCodexBarClient(keychainAccessPolicy: KeychainAccessPolicy): CodexBarClient {
  const binary: ResolvedCodexBarBinary = { command: "codexbar-mock", source: "mock", keychainAccessPolicy };
  const detailFor = (providerId: string, options?: ProviderFetchOptions) =>
    withRequestMetadata(
      normalizeProviderDetailPayload(getMockProviderPayload(providerId), providerId),
      options?.source,
    );

  return {
    binary,
    readConfiguredProviders: async () => getMockConfiguredProviders(),
    listAvailableProviders: async () => getMockAvailableProviders(),
    setProviderEnabled: async () => undefined,
    // Fixture order is fixed, and mock mode must never touch the real config file.
    moveConfiguredProvider: async () => false,
    ensureServe: async () => false,
    fetchProviderDetail: async (providerId, options) => detailFor(providerId, options),
    fetchProviderDetailFromServe: async (providerId, options) => detailFor(providerId, options),
    fetchProviderDetailFromUsageCommand: async (providerId, options) => detailFor(providerId, options),
    fetchProviderUsageWithStatus: async (providerId, options) => ({
      detail: detailFor(providerId, options),
      status: extractProviderStatus(getMockProviderPayload(providerId), providerId),
    }),
  };
}
