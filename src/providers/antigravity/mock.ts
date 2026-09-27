import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY, HOUR } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("antigravity", {
    source: "local",
    version: null,
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 43, 12 * HOUR, "Model quota"),
      buildWindow(now, 76, 24 * HOUR, "Workspace quota"),
      buildWindow(now, 91, 30 * DAY, "Monthly quota"),
      {
        ...buildIdentity("antigravity", "dev@example.com", null, "enterprise"),
      },
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
