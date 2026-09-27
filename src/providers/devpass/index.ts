import type { ProviderModule } from "../module";

const devpass: ProviderModule = {
  metadata: {
    name: "DevPass",
    iconSlug: "devpass",
    iconFallback: "Terminal",
    brandColor: "#2563EB",
    usageSectionLabels: { primary: "Plan credits", secondary: "Premium weekly" },
    dashboardUrl: "https://devpass.llmgateway.io/dashboard",
  },
  mock: { source: "api" },
};

export default devpass;
