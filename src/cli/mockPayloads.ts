import { environment } from "@raycast/api";
import { PROVIDER_MODULES } from "../providers/index";
import { providerModuleById } from "../providers/module";
import { getProviderMetadata, PROVIDER_IDS } from "../providers/registry";
import type { AvailableProvider, ConfiguredProvider, RawProviderPayload } from "../usage/types";
import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY, HOUR } from "./mockShape";

// TODO: add CODEXBAR_MOCK_ERROR fixtures later.

// update const to true when want to use mock data in development
const DEV_MOCK = false;

type MockBuilder = (now: Date) => RawProviderPayload;

const MOCK_SOURCES: Record<string, string> = {};

const MOCK_VERSIONS: Record<string, string | null> = {};

function isCodexBarMockMode(): boolean {
  return environment.isDevelopment && DEV_MOCK;
}

function hashSeed(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }

  return Math.abs(hash);
}

function buildGenericProvider(providerId: string, windowCount: 1 | 2 = 2, source?: string): MockBuilder {
  return (now) => {
    const seed = hashSeed(providerId);
    return buildPayload(providerId, {
      source: source ?? MOCK_SOURCES[providerId] ?? "api",
      version: MOCK_VERSIONS[providerId] ?? null,
      status: null,
      usage: buildUsage(
        now,
        buildWindow(now, 15 + (seed % 70), 5 * HOUR, null),
        windowCount > 1 ? buildWindow(now, 10 + (seed % 80), 7 * DAY, null) : null,
        null,
        buildIdentity(providerId, null, null, "Pro"),
      ),
      credits: null,
      antigravityPlanInfo: null,
      openaiDashboard: null,
    });
  };
}

const MOCK_BUILDERS: Record<string, MockBuilder> = {};

const missingMockProviderIds = PROVIDER_IDS.filter(
  (id) => !MOCK_BUILDERS[id] && !providerModuleById(id, PROVIDER_MODULES)?.mock,
);
if (missingMockProviderIds.length > 0) {
  throw new Error(`Missing mock provider builders: ${missingMockProviderIds.join(", ")}`);
}

export function getMockConfiguredProviders(): ConfiguredProvider[] {
  return PROVIDER_IDS.map((providerId) => getProviderMetadata(providerId));
}

export function getMockAvailableProviders(): AvailableProvider[] {
  return PROVIDER_IDS.map((providerId, index) => {
    const metadata = getProviderMetadata(providerId);
    return {
      id: metadata.id,
      cliProvider: providerId,
      name: metadata.name,
      icon: metadata.icon,
      enabled: index < 5,
    };
  });
}

export function getMockProviderPayload(providerId: string, now: Date = new Date()): RawProviderPayload {
  const mock = providerModuleById(providerId, PROVIDER_MODULES)?.mock;
  if (mock?.build) {
    return mock.build(now);
  }
  if (mock) {
    return buildGenericProvider(providerId, mock.windowCount ?? 2, mock.source)(now);
  }

  const builder = MOCK_BUILDERS[providerId];
  if (!builder) {
    throw new Error(`Unknown mock provider id: ${providerId}`);
  }

  return builder(now);
}

export function getMockProviderPayloads(now: Date = new Date()): RawProviderPayload[] {
  return PROVIDER_IDS.map((providerId) => getMockProviderPayload(providerId, now));
}

export { isCodexBarMockMode };
