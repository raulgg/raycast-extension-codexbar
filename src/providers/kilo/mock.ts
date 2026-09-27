import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("kilo", {
    source: "api",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 52, null, "12/30 credits"),
      buildWindow(now, 86, 7 * DAY, "$4.00 / $20.00 (+ $2.00 bonus)"),
      null,
      buildIdentity("kilo", null, null, "Kilo Pass Pro - Auto top-up: visa"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
