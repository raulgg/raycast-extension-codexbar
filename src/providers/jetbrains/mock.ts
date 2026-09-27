import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("jetbrains", {
    source: "local",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 33, 7 * DAY, "Resets in 7d"),
      null,
      null,
      buildIdentity("jetbrains", null, "IntelliJ IDEA", "AI Pro"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
