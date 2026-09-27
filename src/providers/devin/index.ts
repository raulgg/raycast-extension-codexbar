import type { ProviderModule } from "../module";

const devin: ProviderModule = {
  metadata: {
    name: "Devin",
    iconSlug: "devin",
    iconFallback: "Code",
    brandColor: "#46B482",
    usageSectionLabels: { primary: "Daily", secondary: "Weekly" },
    dashboardUrl: "https://app.devin.ai",
    subscriptionDashboardUrl: "https://app.devin.ai/settings/usage",
  },
  mock: { source: "web" },
};

export default devin;
