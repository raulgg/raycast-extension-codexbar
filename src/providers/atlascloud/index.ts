import type { ProviderModule } from "../module";

const atlascloud: ProviderModule = {
  metadata: {
    name: "Atlas Cloud",
    iconSlug: "atlascloud",
    iconFallback: "Cloud",
    brandColor: "#5975F5",
    usageSectionLabels: { primary: "Balance", secondary: "Balance" },
    dashboardUrl: "https://www.atlascloud.ai/console",
  },
  mock: { source: "api" },
};

export default atlascloud;
