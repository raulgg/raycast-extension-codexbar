import type { ProviderModule } from "../module";

const aiand: ProviderModule = {
  metadata: {
    name: "ai&",
    iconSlug: "aiand",
    iconFallback: "BarChart",
    brandColor: "#E25C2B",
    usageSectionLabels: { primary: "Spend", secondary: "Spend" },
    dashboardUrl: "https://console.aiand.com",
  },
  aliases: ["ai&", "ai-and"],
  mock: { source: "api" },
};

export default aiand;
