import type { ProviderModule } from "../module";

const llmman: ProviderModule = {
  metadata: {
    name: "llmman",
    iconSlug: "llmman",
    iconFallback: "Terminal",
    brandColor: "#6CC5B0",
    usageSectionLabels: { primary: "Memory", secondary: "Models" },
    dashboardUrl: "http://127.0.0.1:17434",
  },
  mock: { source: "api" },
};

export default llmman;
