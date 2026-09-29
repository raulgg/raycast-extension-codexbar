import type { ProviderModule } from "../module";

const raycast: ProviderModule = {
  metadata: {
    name: "Raycast",
    iconSlug: "raycast",
    iconFallback: "AppWindow",
    brandColor: "#FF6363",
    usageSectionLabels: { primary: "Credits", secondary: "Plan" },
    dashboardUrl: "https://www.raycast.com/settings",
  },
  mock: { source: "web" },
};

export default raycast;
