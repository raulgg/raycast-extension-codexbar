import type { ProviderModule } from "../module";

const qoder: ProviderModule = {
  metadata: {
    name: "Qoder",
    iconSlug: "qoder",
    iconFallback: "Code",
    brandColor: "#10B981",
    usageSectionLabels: { primary: "Credits", secondary: "Balance" },
    dashboardUrl: "https://qoder.com/account/usage",
  },
  mock: { source: "web" },
};

export default qoder;
