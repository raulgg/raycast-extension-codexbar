import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY, iso } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("copilot", {
    source: "api",
    version: null,
    status: {
      indicator: "none",
      description: "GitHub Copilot operational",
      url: "https://www.githubstatus.com/",
      updatedAt: iso(now),
    },
    usage: buildUsage(
      now,
      buildWindow(now, 45, 20 * DAY, null),
      buildWindow(now, 67, null, null),
      null,
      buildIdentity("copilot", null, null, "Business"),
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
