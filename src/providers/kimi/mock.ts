import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY, MINUTE } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("kimi", {
    source: "api",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 49, 5 * DAY, "42/200 requests", undefined, 10_080),
      buildWindow(now, 61, 90 * MINUTE, "Rate: 15/60 per 5 hours", undefined, 300),
      null,
      buildIdentity("kimi", null, null, null),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
