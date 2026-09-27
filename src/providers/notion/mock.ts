import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY, HOUR } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("notion", {
    source: "web",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 38, 3 * HOUR, null, undefined, 360),
      buildWindow(now, 71, 20 * DAY, null, undefined, 43_200),
      null,
      buildIdentity("notion", "dev@example.com", null, "Plus"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
