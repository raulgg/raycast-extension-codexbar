import { buildIdentity, buildPayload, buildUsage, buildWindow, HOUR } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("amp", {
    source: "web",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 57, 4 * HOUR, null),
      null,
      null,
      buildIdentity("amp", null, null, "Amp Free"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
