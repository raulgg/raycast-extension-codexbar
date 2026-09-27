import { buildPayload, buildUsage, buildWindow, DAY, MINUTE } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("opencodego", {
    source: "web",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 24, 90 * MINUTE, null),
      buildWindow(now, 44, 5 * DAY, null),
      buildWindow(now, 83, 20 * DAY, null, undefined, 43_200),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
