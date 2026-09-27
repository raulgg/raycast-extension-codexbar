import type { ProviderModule } from "../module";

const typesafe: ProviderModule = {
  metadata: {
    name: "TypeSafe",
    iconSlug: "typesafe",
    iconFallback: "Code",
    brandColor: "#111111",
    usageSectionLabels: { primary: "Spend", secondary: "Spend" },
    dashboardUrl: "https://console.typesafe.ai/usage",
  },
  mock: { source: "api" },
};

export default typesafe;
