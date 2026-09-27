import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("perplexity", {
    source: "api",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 54, 30 * DAY, "54/100 credits"),
      buildWindow(now, 29, null, "20 promo credits"),
      buildWindow(now, 71, null, "8 purchased credits"),
      buildIdentity("perplexity", null, null, "Pro"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
