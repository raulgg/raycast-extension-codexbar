import { environment } from "@raycast/api";
import { providerModuleById } from "../providers/module";
import { getProviderMetadata, PROVIDER_IDS } from "../providers/registry";
import type { AvailableProvider, ConfiguredProvider, RawProviderPayload } from "../usage/types";
import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY, HOUR, iso, offsetIso } from "./mockShape";

// TODO: add CODEXBAR_MOCK_ERROR fixtures later.

// update const to true when want to use mock data in development
const DEV_MOCK = false;

type MockBuilder = (now: Date) => RawProviderPayload;

const MOCK_SOURCES: Record<string, string> = {
  claude: "web",
};

const MOCK_VERSIONS: Record<string, string | null> = {
  claude: "1.0.0",
};

function isCodexBarMockMode(): boolean {
  return environment.isDevelopment && DEV_MOCK;
}

function buildStatus(
  description: string,
  url: string,
  now: Date,
  indicator: "none" | "minor" | "major" | "critical" | "maintenance" | "unknown" = "none",
): Record<string, unknown> {
  return {
    indicator,
    description,
    url,
    updatedAt: iso(now),
  };
}

function buildClaudeProviderCost(now: Date): Record<string, unknown> {
  return {
    used: 1.42,
    limit: 20,
    currencyCode: "USD",
    period: "monthly",
    resetsAt: offsetIso(now, 30 * DAY),
    updatedAt: iso(now),
  };
}

function buildClaude(now: Date): RawProviderPayload {
  return buildPayload("claude", {
    source: MOCK_SOURCES.claude,
    version: MOCK_VERSIONS.claude,
    status: buildStatus("Claude operational", "https://status.anthropic.com", now),
    usage: buildUsage(
      now,
      buildWindow(now, 47, 3 * HOUR, "Session"),
      buildWindow(now, 71, 7 * DAY, "Weekly", 4),
      buildWindow(now, 91, 30 * DAY, "Monthly"),
      {
        providerCost: buildClaudeProviderCost(now),
        subscriptionRenewsAt: offsetIso(now, 21 * DAY),
        ...buildIdentity("claude", "dev@example.com", "Example Labs", "oauth"),
      },
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
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

const MOCK_BUILDERS: Record<string, MockBuilder> = {
  claude: buildClaude,
};

const missingMockProviderIds = PROVIDER_IDS.filter((id) => !MOCK_BUILDERS[id] && !providerModuleById(id)?.mock);
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
  const mock = providerModuleById(providerId)?.mock;
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
