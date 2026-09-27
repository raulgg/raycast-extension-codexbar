import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY, HOUR, iso, offsetIso } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

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

export function build(now: Date): RawProviderPayload {
  return buildPayload("claude", {
    source: "web",
    version: "1.0.0",
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
