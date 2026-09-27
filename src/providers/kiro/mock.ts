import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("kiro", {
    source: "cli",
    version: "0.4.0",
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 38, 30 * DAY, null),
      buildWindow(now, 79, 14 * DAY, "expires in 14d"),
      null,
      buildIdentity("kiro", null, "Kiro Pro", "Kiro Pro"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
