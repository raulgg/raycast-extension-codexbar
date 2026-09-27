import { buildIdentity, buildPayload, buildUsage } from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

export function build(now: Date): RawProviderPayload {
  return buildPayload("vertexai", {
    source: "oauth",
    version: null,
    status: null,
    usage: buildUsage(now, null, null, null, {
      ...buildIdentity("vertexai", "dev@example.com", "example-project", "gcloud"),
    }),
    credits: null,
    antigravityPlanInfo: null,
    openaiDashboard: null,
  });
}
