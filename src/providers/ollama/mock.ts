import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY, MINUTE } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("ollama", {
    source: "web",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 26, 90 * MINUTE, null),
      buildWindow(now, 64, 7 * DAY, null),
      null,
      buildIdentity("ollama", "dev@example.com", null, "Pro"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
