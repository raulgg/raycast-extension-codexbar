import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY, iso } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

function buildStatus(description: string, url: string, now: Date): Record<string, unknown> {
  return {
    indicator: "none",
    description,
    url,
    updatedAt: iso(now),
  };
}

export function build(now: Date): RawProviderPayload {
  return buildPayload("factory", {
    source: "web",
    version: null,
    status: buildStatus("Factory operational", "https://status.factory.ai", now),
    usage: buildUsage(
      now,
      buildWindow(now, 56, 2 * DAY, "Resets in 2d"),
      buildWindow(now, 81, 7 * DAY, "Resets in 7d"),
      null,
      buildIdentity("factory", "dev@example.com", "Example Labs", "Factory Pro"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
