import { labelLowercaseSlug } from "../../usage/identity";
import { firstString, toRecord } from "../../usage/json";
import type { RawProviderPayload } from "../../usage/types";
import type { ProviderModule } from "../module";

// Ports CodexBarCore/Providers/Claude/ClaudePlan.swift. `fromCompatibilityLoginMethod`
// splits the login-method string into alphanumeric words and matches the first plan
// keyword in priority order. Max, Pro, Team, and Ultra are subscriptions. Enterprise is not.
type ClaudePlan = "max" | "pro" | "team" | "enterprise" | "ultra";

const CLAUDE_SUBSCRIPTION_PLANS = new Set<ClaudePlan>(["max", "pro", "team", "ultra"]);

function normalizedPlanWords(text: string | undefined): string[] {
  return (text ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function claudePlanFromLoginMethod(text: string | undefined): ClaudePlan | undefined {
  const words = normalizedPlanWords(text);
  if (words.length === 0) {
    return undefined;
  }
  if (words.includes("max") || words.some((word) => word.includes("claudemax"))) {
    return "max";
  }
  if (words.includes("pro") || words.includes("claudepro")) {
    return "pro";
  }
  if (words.includes("team") || words.includes("claudeteam")) {
    return "team";
  }
  if (words.includes("enterprise") || words.includes("claudeenterprise")) {
    return "enterprise";
  }
  if (words.includes("ultra") || words.includes("claudeultra")) {
    return "ultra";
  }
  return undefined;
}

function isClaudeSubscriptionLoginMethod(text: string | undefined): boolean {
  const plan = claudePlanFromLoginMethod(text);
  return plan === undefined ? false : CLAUDE_SUBSCRIPTION_PLANS.has(plan);
}

// StatusItemController+Actions.swift plan switch. A present dashboardUrl replaces the
// catalog URL, so this returns the chosen page instead of undefined.
export function dashboardUrl(consoleUrl: string, subscriptionUrl: string): NonNullable<ProviderModule["dashboardUrl"]> {
  return ({ planText }) => (isClaudeSubscriptionLoginMethod(planText) ? subscriptionUrl : consoleUrl);
}

// Plan, subscriptionType, and rateLimitTier win over the generic login-method walk.
// The header is still that login-method string, slug-labeled the same way.
function extractClaudePlanText(payload: RawProviderPayload): string | undefined {
  const usage = toRecord(payload.usage);
  const usageIdentity = toRecord(usage?.identity);
  const identity = toRecord(payload.identity);
  const account = toRecord(payload.account);

  return firstString(
    payload.plan,
    identity?.plan,
    usage?.plan,
    usageIdentity?.plan,
    account?.plan,
    payload.subscriptionType,
    identity?.subscriptionType,
    usage?.subscriptionType,
    usageIdentity?.subscriptionType,
    account?.subscriptionType,
    payload.rateLimitTier,
    identity?.rateLimitTier,
    usage?.rateLimitTier,
    usageIdentity?.rateLimitTier,
    account?.rateLimitTier,
  );
}

export const interpret: NonNullable<ProviderModule["interpret"]> = ({ payload, sections, planText }) => {
  const claudePlan = extractClaudePlanText(payload);
  return {
    sections,
    planText: claudePlan === undefined ? planText : labelLowercaseSlug(claudePlan),
  };
};
