import { buildIdentity, buildPayload, buildUsage, buildWindow, HOUR } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("minimax", {
    source: "web",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 63, 5 * HOUR, "1000 prompts / 5 hours"),
      null,
      null,
      buildIdentity("minimax", null, null, "Pro"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
