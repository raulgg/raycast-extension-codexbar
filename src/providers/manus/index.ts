import type { ProviderModule } from "../module";

const manus: ProviderModule = {
  metadata: {
    name: "Manus",
    iconSlug: "manus",
    brandColor: "#34322D",
    usageSectionLabels: { primary: "Monthly credits", secondary: "Daily refresh" },
    dashboardUrl: "https://manus.im",
  },
  mock: { source: "web" },
};

export default manus;
