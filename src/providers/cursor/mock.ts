import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY, HOUR, iso, offsetIso } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

function buildCursorProviderCost(now: Date): Record<string, unknown> {
  return {
    used: 3.08,
    limit: 25,
    currencyCode: "USD",
    period: "monthly",
    resetsAt: offsetIso(now, 30 * DAY),
    updatedAt: iso(now),
  };
}

export function build(now: Date): RawProviderPayload {
  return buildPayload("cursor", {
    source: "web",
    version: null,
    status: {
      indicator: "none",
      description: "Cursor operational",
      url: "https://status.cursor.com",
      updatedAt: iso(now),
    },
    usage: buildUsage(
      now,
      buildWindow(now, 34, 3 * HOUR, "Resets in 3h", undefined, 24 * 60),
      buildWindow(now, 68, 24 * HOUR, "Resets tomorrow"),
      buildWindow(now, 79, 7 * DAY, "Resets next week"),
      {
        providerCost: buildCursorProviderCost(now),
        ...buildIdentity("cursor", "dev@example.com", null, "Pro"),
      },
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
