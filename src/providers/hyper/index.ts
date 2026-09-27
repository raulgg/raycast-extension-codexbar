import type { ProviderModule } from "../module";

const hyper: ProviderModule = {
  metadata: {
    name: "Charm Hyper",
    iconSlug: "hyper",
    iconFallback: "Bolt",
    brandColor: "#FF60FF",
    usageSectionLabels: { primary: "Balance", secondary: "Balance" },
    dashboardUrl: "https://hyper.charm.land",
  },
  mock: { source: "api" },
};

export default hyper;
