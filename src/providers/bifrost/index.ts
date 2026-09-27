import type { ProviderModule } from "../module";

const bifrost: ProviderModule = {
  metadata: {
    name: "Bifrost",
    iconSlug: "bifrost",
    iconFallback: "Network",
    brandColor: "#33C09E",
    usageSectionLabels: { primary: "Budget", secondary: "Secondary budget" },
  },
  mock: { source: "api" },
};

export default bifrost;
