import type { ProviderModule } from "../module";

const longcat: ProviderModule = {
  metadata: {
    name: "LongCat",
    iconSlug: "longcat",
    iconFallback: "Bubble",
    brandColor: "#FFD100",
    usageSectionLabels: { primary: "Quota", secondary: "Fuel Pack" },
    dashboardUrl: "https://longcat.chat/platform/",
  },
  aliases: ["long-cat", "lc"],
  mock: { source: "web" },
};

export default longcat;
