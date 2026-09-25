import { toRecord, toTrimmedString } from "../json";
import type { ProviderSection, RawProviderPayload } from "../types";

// MenuCardView+ModelHelpers.antigravityMetrics: extras with this prefix are the real
// meters. Primary and Secondary are copies for the list adornment, so skip them on the card.
const ANTIGRAVITY_QUOTA_SUMMARY_WINDOW_ID_PREFIX = "antigravity-quota-summary-";

function hasAntigravityQuotaSummaryWindows(payload: RawProviderPayload): boolean {
  const extraRateWindows = toRecord(payload.usage)?.extraRateWindows;
  if (!Array.isArray(extraRateWindows)) {
    return false;
  }

  return extraRateWindows.some((entry) =>
    toTrimmedString(toRecord(entry)?.id)?.startsWith(ANTIGRAVITY_QUOTA_SUMMARY_WINDOW_ID_PREFIX),
  );
}

function hideAntigravityRepresentativeSlots(sections: ProviderSection[]): ProviderSection[] {
  return sections.map((section) => (section.kind === "usage" ? { ...section, includeInDetail: false } : section));
}

/**
 * On the raw path, Antigravity's Primary/Secondary are list-adornment copies of
 * the quota-summary extras, so the detail card hides them when those extras are
 * present. Presentation meters are already curated upstream and are left alone.
 */
export function applyAntigravityDetailRules(
  providerId: string,
  payload: RawProviderPayload,
  hasPresentationMeters: boolean,
  sections: ProviderSection[],
): ProviderSection[] {
  if (hasPresentationMeters || providerId !== "antigravity" || !hasAntigravityQuotaSummaryWindows(payload)) {
    return sections;
  }

  return hideAntigravityRepresentativeSlots(sections);
}
