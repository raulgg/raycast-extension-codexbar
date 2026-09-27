import type { ProviderModule } from "../module";

const replicate: ProviderModule = {
  metadata: {
    name: "Replicate",
    iconSlug: "replicate",
    iconFallback: "Box",
    brandColor: "#000000",
    usageSectionLabels: { primary: "Spend", secondary: "Spend" },
    dashboardUrl: "https://replicate.com/account/billing",
  },
  aliases: ["r8"],
  mock: { source: "api" },
};

export default replicate;
