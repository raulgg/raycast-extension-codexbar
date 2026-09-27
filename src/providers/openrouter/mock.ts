import { buildIdentity, buildPayload, buildUsage, buildWindow, iso } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

function buildOpenRouterUsage(now: Date): Record<string, unknown> {
  return {
    totalCredits: 50,
    totalUsage: 24.5,
    balance: 25.5,
    usedPercent: 49,
    keyDataFetched: true,
    keyLimit: 100,
    keyUsage: 47,
    rateLimit: {
      requests: 10,
      interval: "10s",
    },
    updatedAt: iso(now),
  };
}

export function build(now: Date): RawProviderPayload {
  return buildPayload("openrouter", {
    source: "api",
    version: null,
    status: null,
    usage: buildUsage(now, buildWindow(now, 47, null, null), null, null, {
      openRouterUsage: buildOpenRouterUsage(now),
      ...buildIdentity("openrouter", null, null, "Balance: $25.50"),
    }),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
