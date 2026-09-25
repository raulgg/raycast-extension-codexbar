import {
  getCodexBarAvailability,
  type CodexBarAvailability,
  type CodexBarCapabilities,
  type InstallHelpState,
  type ResolvedCodexBarBinary,
} from "../cli/binary";
import { fetchUsage, type FetchUsageOptions } from "../cli/fetch";
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
} from "../config/providerConfig";
import { isRecord } from "../usage/json";
import type { AvailableProvider, ConfiguredProvider } from "../usage/types";

// Everything the extension asks of a CodexBar installation, behind one object.
// The real client wraps the CLI process boundary and the shared config file;
// the mock client (development builds with DEV_MOCK) answers from fixtures.
// Callers never branch on mock mode themselves: the choice is made once, in
// getCodexBarClientAvailability. Usage comes back raw; services/providerDetail
// turns it into ProviderDetailData.
export type CodexBarClient = {
  readonly binary: ResolvedCodexBarBinary;
  readConfiguredProviders(): Promise<ConfiguredProvider[]>;
  listAvailableProviders(): Promise<AvailableProvider[]>;
  setProviderEnabled(cliProvider: string, enabled: boolean): Promise<void>;
  /** Resolves false when nothing moved (already at the edge, or unknown id). */
  moveConfiguredProvider(providerId: string, direction: ProviderMoveDirection): Promise<boolean>;
  /** Background refresh only (ADR-0002). Resolves true when a healthy, attested serve is available. */
  ensureServe(): Promise<boolean>;
  /** One Provider's raw usage payload, via the requested transport. */
  fetchUsage(providerId: string, options?: FetchUsageOptions): Promise<unknown>;
};

export type CodexBarClientAvailability =
  { status: "available"; client: CodexBarClient } | Exclude<CodexBarAvailability, { status: "available" }>;

// useCachedPromise persists this as JSON, so it holds no client methods.
export type CodexBarAvailabilitySnapshot =
  | { status: "available"; mode: "cli"; binary: ResolvedCodexBarBinary }
  | { status: "available"; mode: "mock"; keychainAccessPolicy: KeychainAccessPolicy }
  | { status: "unavailable"; install: InstallHelpState; errorMessage?: string }
  | { status: "error"; errorMessage: string };

export async function loadCodexBarAvailabilitySnapshot(
  keychainAccessPolicy: KeychainAccessPolicy,
): Promise<CodexBarAvailabilitySnapshot> {
  if (isCodexBarMockMode()) {
    return { status: "available", mode: "mock", keychainAccessPolicy };
  }

  const availability = await getCodexBarAvailability(keychainAccessPolicy);
  if (availability.status === "available") {
    return { status: "available", mode: "cli", binary: availability.binary };
  }

  if (availability.status === "unavailable") {
    return {
      status: "unavailable",
      install: availability.install,
      ...(availability.error ? { errorMessage: errorMessage(availability.error) } : {}),
    };
  }

  return { status: "error", errorMessage: errorMessage(availability.error) };
}

export async function getCodexBarClientAvailability(
  keychainAccessPolicy: KeychainAccessPolicy,
): Promise<CodexBarClientAvailability> {
  return hydrateCodexBarClientAvailability(await loadCodexBarAvailabilitySnapshot(keychainAccessPolicy));
}

export function createCodexBarClient(binary: ResolvedCodexBarBinary): CodexBarClient {
  return {
    binary,
    readConfiguredProviders: () => readConfiguredProvidersFromConfig(),
    listAvailableProviders: () => listAvailableProviders(binary),
    setProviderEnabled: (cliProvider, enabled) => setProviderEnabled(binary, cliProvider, enabled),
    moveConfiguredProvider: (providerId, direction) => moveConfiguredProviderInConfig(providerId, direction),
    ensureServe: () => ensureCodexBarServe(binary),
    fetchUsage: (providerId, options) => fetchUsage(binary, providerId, options),
  };
}

export function createMockCodexBarClient(keychainAccessPolicy: KeychainAccessPolicy): CodexBarClient {
  return {
    binary: { command: "codexbar-mock", source: "mock", keychainAccessPolicy },
    readConfiguredProviders: async () => getMockConfiguredProviders(),
    listAvailableProviders: async () => getMockAvailableProviders(),
    setProviderEnabled: async () => undefined,
    // Fixture order is fixed, and mock mode must never touch the real config file.
    moveConfiguredProvider: async () => false,
    ensureServe: async () => false,
    fetchUsage: async (providerId) => getMockProviderPayload(providerId),
  };
}

export function hydrateCodexBarClientAvailability(snapshot: unknown): CodexBarClientAvailability {
  if (!isRecord(snapshot)) {
    return unreadableAvailability();
  }

  if (snapshot.status === "available" && snapshot.mode === "mock") {
    if (!isKeychainAccessPolicy(snapshot.keychainAccessPolicy)) {
      return unreadableAvailability();
    }
    return { status: "available", client: createMockCodexBarClient(snapshot.keychainAccessPolicy) };
  }

  if (snapshot.status === "available" && snapshot.mode === "cli") {
    if (!isResolvedBinary(snapshot.binary)) {
      return unreadableAvailability();
    }
    return { status: "available", client: createCodexBarClient(snapshot.binary) };
  }

  if (snapshot.status === "unavailable") {
    if (!isInstallHelpState(snapshot.install)) {
      return unreadableAvailability();
    }
    const restoredErrorMessage = typeof snapshot.errorMessage === "string" ? snapshot.errorMessage.trim() : "";
    return {
      status: "unavailable",
      install: snapshot.install,
      ...(restoredErrorMessage ? { error: new Error(restoredErrorMessage) } : {}),
    };
  }

  if (snapshot.status === "error") {
    return {
      status: "error",
      error: new Error(errorMessageText(typeof snapshot.errorMessage === "string" ? snapshot.errorMessage : "")),
    };
  }

  return unreadableAvailability();
}

const UNREADABLE_AVAILABILITY =
  "Cached CodexBar availability could not be read. Retry to check the CodexBar CLI again.";
const UNKNOWN_AVAILABILITY_ERROR = "Unknown CodexBar availability error";

function unreadableAvailability(): CodexBarClientAvailability {
  return { status: "error", error: new Error(UNREADABLE_AVAILABILITY) };
}

function errorMessage(error: Error): string {
  return errorMessageText(error.message);
}

function errorMessageText(message: string): string {
  const trimmed = message.trim();
  return trimmed || UNKNOWN_AVAILABILITY_ERROR;
}

function isKeychainAccessPolicy(value: unknown): value is KeychainAccessPolicy {
  return value === "default" || value === "disabled";
}

function isResolvedBinary(value: unknown): value is ResolvedCodexBarBinary {
  if (!isRecord(value)) return false;
  if (typeof value.command !== "string" || value.command.length === 0) return false;
  if (value.source !== "path" && value.source !== "fallback" && value.source !== "mock") return false;
  if (!isKeychainAccessPolicy(value.keychainAccessPolicy)) return false;
  if (value.capabilities !== undefined && !isCodexBarCapabilities(value.capabilities)) return false;
  return true;
}

function isCodexBarCapabilities(value: unknown): value is CodexBarCapabilities {
  if (!isRecord(value)) return false;
  return (
    typeof value.appFetchProfile === "boolean" &&
    typeof value.interactionModes === "boolean" &&
    Array.isArray(value.presentationSchemaVersions) &&
    value.presentationSchemaVersions.every((version) => typeof version === "number" && Number.isFinite(version)) &&
    typeof value.serveAppFetchProfile === "boolean" &&
    typeof value.serveForceRefresh === "boolean"
  );
}

function isInstallHelpState(value: unknown): value is InstallHelpState {
  if (!isRecord(value)) return false;
  if (typeof value.title !== "string" || typeof value.markdown !== "string") return false;
  if (
    typeof value.docsUrl !== "string" ||
    typeof value.releasesUrl !== "string" ||
    typeof value.repositoryUrl !== "string"
  ) {
    return false;
  }
  if (value.kind === "cli-missing") {
    return typeof value.helperPath === "string" && value.helperPath.length > 0;
  }
  if (value.kind !== "app-missing") return false;
  if (value.homebrewCommands === undefined) return true;
  return (
    isRecord(value.homebrewCommands) &&
    typeof value.homebrewCommands.appAndCli === "string" &&
    typeof value.homebrewCommands.cliOnly === "string"
  );
}
