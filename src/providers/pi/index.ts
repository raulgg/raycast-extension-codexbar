import type { ProviderModule } from "../module";

const pi: ProviderModule = {
  metadata: {
    name: "Pi",
    iconSlug: "pi",
    iconFallback: "Terminal",
    brandColor: "#7C3AED",
    usageSectionLabels: { primary: "Session", secondary: "Weekly" },
    dashboardUrl: "https://github.com/badlogic/pi-mono",
  },
  mock: { source: "api" },
};

export default pi;
