import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY, HOUR } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("zai", {
    source: "api",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 35, 4 * HOUR, "1 week window", undefined, 300),
      buildWindow(now, 58, 30 * DAY, "Monthly"),
      buildWindow(now, 74, 2 * HOUR, "5 hours window"),
      buildIdentity("zai", null, null, "Pro"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
