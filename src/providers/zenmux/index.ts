import type { ProviderModule } from "../module";

const zenmux: ProviderModule = {
  metadata: {
    name: "ZenMux",
    iconSlug: "zenmux",
    iconFallback: "Network",
    brandColor: "#6C5CE7",
    usageSectionLabels: { primary: "5-hour quota", secondary: "Weekly quota" },
    dashboardUrl: "https://zenmux.ai/platform/management",
  },
  aliases: ["zen-mux"],
  mock: { source: "api" },
};

export default zenmux;
