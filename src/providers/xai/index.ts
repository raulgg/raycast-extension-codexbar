import type { ProviderModule } from "../module";

const xai: ProviderModule = {
  metadata: {
    name: "xAI",
    iconSlug: "xai",
    iconFallback: "Stars",
    brandColor: "#8E8E93",
    usageSectionLabels: { primary: "Spend", secondary: "Spend" },
    dashboardUrl: "https://console.x.ai",
    statusPageUrl: "https://status.x.ai",
  },
  mock: { source: "api" },
};

export default xai;
