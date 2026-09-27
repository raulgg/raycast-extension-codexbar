import { buildIdentity, buildPayload, buildUsage, buildWindow } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("warp", {
    source: "api",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 0, null, "Unlimited"),
      buildWindow(now, 84, null, "2 bonus credits"),
      null,
      buildIdentity("warp", null, null, null),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
