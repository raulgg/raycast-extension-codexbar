import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("grok", {
    source: "web",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 42, 5 * DAY, null),
      buildWindow(now, 8, 20 * DAY, null),
      null,
      buildIdentity("grok", "dev@example.com", null, "SuperGrok"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
