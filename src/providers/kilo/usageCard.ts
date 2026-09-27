import { labelLowercaseSlug } from "../../usage/identity";
import type { ProviderModule } from "../module";

// Kilo's plan text reads "<pass> · <detail> · …"; the pass name is the first
// segment unless the string is only an auto top-up notice. A lowercase slug
// pass is labeled like other plan text (tier_99 -> Tier 99, oauth -> OAuth).
export const interpret: NonNullable<ProviderModule["interpret"]> = ({ sections, planText }) => ({
  sections,
  planText: planText === undefined ? undefined : labelLowercaseSlug(kiloPassName(planText) ?? planText),
});

function kiloPassName(rawPlanText: string | undefined): string | undefined {
  if (!rawPlanText) {
    return undefined;
  }

  const parts = rawPlanText
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  const firstPart = parts[0];
  if (!firstPart || firstPart.toLowerCase().startsWith("auto top-up:")) {
    return undefined;
  }

  return firstPart;
}
