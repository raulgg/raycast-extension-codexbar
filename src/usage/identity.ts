import { firstString, toRecord } from "./json";
import { extractClaudePlanText } from "./providerRules/claude";
import type { RawProviderPayload } from "./types";

// Account identity shown in the detail header: the account email and the plan
// tier read from upstream's single loginMethod field (see CONTEXT.md).

export function extractAccountOrganization(payload: RawProviderPayload): string | undefined {
  const usage = toRecord(payload.usage);
  const usageIdentity = toRecord(usage?.identity);
  const identity = toRecord(payload.identity);
  const account = toRecord(payload.account);

  return firstString(
    usageIdentity?.accountOrganization,
    usage?.accountOrganization,
    identity?.accountOrganization,
    account?.accountOrganization,
    payload.accountOrganization,
  );
}

export function extractAccountEmail(payload: RawProviderPayload): string | undefined {
  const usage = toRecord(payload.usage);
  const usageIdentity = toRecord(usage?.identity);
  const identity = toRecord(payload.identity);
  const account = toRecord(payload.account);

  return firstString(
    payload.accountEmail,
    identity?.accountEmail,
    usage?.accountEmail,
    usageIdentity?.accountEmail,
    account?.accountEmail,
    account?.email,
  );
}

function extractRawPlanText(providerId: string, payload: RawProviderPayload): string | undefined {
  const usage = toRecord(payload.usage);
  const usageIdentity = toRecord(usage?.identity);
  const identity = toRecord(payload.identity);
  const account = toRecord(payload.account);
  const dashboard = toRecord(payload.openaiDashboard);

  if (providerId === "claude") {
    const claudePlan = extractClaudePlanText(payload);
    if (claudePlan) {
      return claudePlan;
    }
  }

  return firstString(
    payload.loginMethod,
    identity?.loginMethod,
    usage?.loginMethod,
    usageIdentity?.loginMethod,
    account?.loginMethod,
    account?.plan,
    dashboard?.accountPlan,
  );
}

function formatSlugLabel(raw: string): string {
  const acronymMap = new Map<string, string>([
    ["api", "API"],
    ["cli", "CLI"],
    ["oauth", "OAuth"],
    ["sso", "SSO"],
    ["usd", "USD"],
    ["openai", "OpenAI"],
  ]);

  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => {
      const normalized = part.toLowerCase();
      const acronym = acronymMap.get(normalized);
      if (acronym) {
        return acronym;
      }

      return `${normalized[0]?.toUpperCase() ?? ""}${normalized.slice(1)}`;
    })
    .join(" ");
}

// Labels a plan slug the way formatPlanText does (tier_99 -> Tier 99, oauth -> OAuth).
// Mixed-case or multi-word text is left unchanged.
export function labelLowercaseSlug(raw: string): string {
  if (/^[a-z0-9_-]+$/i.test(raw) && raw === raw.toLowerCase()) {
    return formatSlugLabel(raw);
  }

  return raw;
}

export function formatPlanText(providerId: string, payload: RawProviderPayload): string | undefined {
  const rawPlanText = extractRawPlanText(providerId, payload);
  if (!rawPlanText) {
    return undefined;
  }

  return labelLowercaseSlug(rawPlanText);
}
