import type { ProviderModule } from "../module";

const moonshot: ProviderModule = {
  metadata: {
    name: "Moonshot / Kimi Open Platform",
    iconSlug: "kimi",
    brandColor: "#205DEB",
    usageSectionLabels: { primary: "Balance", secondary: "Balance" },
    dashboardUrl: "https://platform.moonshot.ai/console/account",
  },
  mock: { source: "api" },
};

export default moonshot;
