import type { ProviderModule } from "../module";

const xkiro: ProviderModule = {
  metadata: {
    name: "xKiro",
    iconSlug: "xkiro",
    iconFallback: "Bolt",
    brandColor: "#52C99B",
    usageSectionLabels: { primary: "Daily free tokens", secondary: "Weekly" },
    dashboardUrl: "https://xkiro.com",
  },
  mock: { source: "api" },
};

export default xkiro;
