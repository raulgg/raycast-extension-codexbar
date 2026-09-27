import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("augment", {
    source: "web",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 46, 3 * DAY, "Resets in 3d"),
      null,
      null,
      buildIdentity("augment", "dev@example.com", null, "Pro"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
