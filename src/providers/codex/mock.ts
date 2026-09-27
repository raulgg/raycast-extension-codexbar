import {
  buildIdentity,
  buildPayload,
  buildUsage,
  buildWindow,
  DAY,
  HOUR,
  iso,
  MINUTE,
  offsetIso,
} from "../../cli/mockShape";
import type { RawProviderPayload } from "../../usage/types";

function buildStatus(
  description: string,
  url: string,
  now: Date,
  indicator: "none" | "minor" | "major" | "critical" | "maintenance" | "unknown" = "none",
): Record<string, unknown> {
  return {
    indicator,
    description,
    url,
    updatedAt: iso(now),
  };
}

function buildCredits(now: Date, remaining: number, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    remaining,
    events: [
      {
        id: "00000000-0000-0000-0000-000000000001",
        date: offsetIso(now, -DAY),
        service: "Codex",
        creditsUsed: 3.5,
      },
    ],
    updatedAt: iso(now),
    ...extras,
  };
}

function buildOpenAIDashboard(now: Date): Record<string, unknown> {
  return {
    signedInEmail: "dev@example.com",
    codeReviewRemainingPercent: 72,
    creditEvents: [
      {
        id: "00000000-0000-0000-0000-000000000002",
        date: offsetIso(now, -DAY),
        service: "CLI",
        creditsUsed: 3.5,
      },
      {
        id: "00000000-0000-0000-0000-000000000003",
        date: iso(now),
        service: "Code Review",
        creditsUsed: 1.25,
      },
    ],
    dailyBreakdown: [
      {
        day: iso(now).slice(0, 10),
        services: [{ service: "CLI", creditsUsed: 3.5 }],
        totalCreditsUsed: 3.5,
      },
    ],
    usageBreakdown: [
      {
        day: iso(now).slice(0, 10),
        services: [{ service: "Code Review", creditsUsed: 1.25 }],
        totalCreditsUsed: 1.25,
      },
    ],
    creditsPurchaseURL: "https://platform.openai.com/account/billing",
    primaryLimit: buildWindow(now, 28, 90 * MINUTE, "Session"),
    secondaryLimit: buildWindow(now, 59, 7 * DAY, "Weekly"),
    creditsRemaining: 16.5,
    accountPlan: "pro",
    updatedAt: iso(now),
  };
}

export function build(now: Date): RawProviderPayload {
  return buildPayload("codex", {
    source: "codex-cli",
    version: "0.6.0",
    status: buildStatus("Partial System Degradation", "https://status.openai.com", now, "minor"),
    usage: buildUsage(
      now,
      buildWindow(now, 61, 90 * MINUTE, "Session"),
      buildWindow(now, 19, 7 * DAY, "Weekly"),
      null,
      {
        extraRateWindows: [
          {
            id: "codex-spark",
            title: "Codex Spark",
            window: buildWindow(now, 12, 5 * HOUR, null, undefined, 300),
          },
        ],
        codexResetCredits: {
          credits: [
            {
              id: "reset-credit-1",
              status: "available",
              reset_type: "weekly",
              granted_at: offsetIso(now, -DAY),
              expires_at: offsetIso(now, 2 * DAY),
            },
            {
              id: "reset-credit-2",
              status: "available",
              reset_type: "weekly",
              granted_at: offsetIso(now, -DAY),
            },
            {
              id: "reset-credit-3",
              status: "redeemed",
              reset_type: "weekly",
              granted_at: offsetIso(now, -2 * DAY),
              expires_at: offsetIso(now, DAY),
            },
            {
              id: "reset-credit-4",
              status: "available",
              reset_type: "weekly",
              granted_at: offsetIso(now, -2 * DAY),
              expires_at: offsetIso(now, -HOUR),
            },
          ],
        },
        ...buildIdentity("codex", "dev@example.com", null, "pro"),
      },
    ),
    credits: buildCredits(now, 12.5),
    antigravityPlanInfo: null,
    openaiDashboard: buildOpenAIDashboard(now),
  });
}
