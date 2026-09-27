import { buildPayload, buildUsage, buildWindow, HOUR } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("opencode", {
    source: "web",
    version: null,
    status: null,
    usage: buildUsage(now, buildWindow(now, 29, 2 * HOUR, null), buildWindow(now, 56, 24 * HOUR, null)),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
