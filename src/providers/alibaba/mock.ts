import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY, HOUR } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("alibaba", {
    source: "web",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 39, 5 * HOUR, "39 / 100 used"),
      buildWindow(now, 63, 24 * HOUR, "63 / 100 used"),
      buildWindow(now, 88, 20 * DAY, "88 / 100 used", undefined, 43_200),
      buildIdentity("alibaba", null, null, "Pro"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
