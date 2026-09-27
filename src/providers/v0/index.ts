import type { ProviderModule } from "../module";

const v0: ProviderModule = {
  metadata: {
    name: "v0",
    iconSlug: "v0",
    iconFallback: "Code",
    brandColor: "#111111",
    usageSectionLabels: { primary: "Billing", secondary: "Rate limit" },
    dashboardUrl: "https://v0.app/settings/billing",
  },
  mock: { source: "api" },
};

export default v0;
