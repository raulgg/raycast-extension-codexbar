import type { ProviderModule } from "../module";

const poe: ProviderModule = {
  metadata: {
    name: "Poe",
    iconSlug: "poe",
    iconFallback: "Bubble",
    brandColor: "#5D5CDE",
    usageSectionLabels: { primary: "Points", secondary: "Points" },
    dashboardUrl: "https://poe.com/api/keys",
  },
  mock: { source: "api" },
};

export default poe;
