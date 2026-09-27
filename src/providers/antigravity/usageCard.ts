import { toRecord, toTrimmedString } from "../../usage/json";
import type { ProviderSection, RawProviderPayload } from "../../usage/types";
import type { ProviderModule } from "../module";

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
  return sections.map((section) =>
    section.kind === "usage" && (section.title === "Primary" || section.title === "Secondary")
      ? { ...section, includeInDetail: false }
      : section,
  );
}

// On the raw path, Primary and Secondary are list-adornment copies of the
// quota-summary extras. Presentation meters are already curated and stay as built.
export const interpret: NonNullable<ProviderModule["interpret"]> = ({
  payload,
  sections,
  planText,
  hasPresentationMeters,
}) => {
  if (hasPresentationMeters || !hasAntigravityQuotaSummaryWindows(payload)) {
    return { sections, planText };
  }

  return { sections: hideAntigravityRepresentativeSlots(sections), planText };
};
