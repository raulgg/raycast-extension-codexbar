import { buildIdentity, buildPayload, buildUsage, buildWindow, DAY, HOUR } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("gemini", {
    source: "api",
    version: "0.12.0",
    status: null,
    usage: buildUsage(
      now,
      buildWindow(now, 51, 6 * HOUR, "Free tier"),
      buildWindow(now, 67, 24 * HOUR, "Pro quota"),
      buildWindow(now, 84, 30 * DAY, "Monthly cap"),
      {
        ...buildIdentity("gemini", "dev@example.com", null, "Google AI Pro"),
      },
    ),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
