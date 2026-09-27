import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("synthetic", {
    source: "api",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 22, 2 * DAY, null),
      buildWindow(now, 70, null, "60 minutes"),
      null,
      buildIdentity("synthetic", null, null, "Pro"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
