import type { ProviderModule } from "../module";

const aixy: ProviderModule = {
  metadata: {
    name: "Aixy",
    iconSlug: "aixy",
    iconFallback: "Network",
    brandColor: "#123650",
    usageSectionLabels: { primary: "Budget", secondary: "Secondary budget" },
    dashboardUrl: "https://dash.aixy-gateway.com",
  },
  mock: { source: "api" },
};

export default aixy;
