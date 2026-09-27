import type { ProviderModule } from "../module";

const muse: ProviderModule = {
  metadata: {
    name: "Muse Code",
    iconSlug: "muse",
    iconFallback: "Stars",
    brandColor: "#0668E1",
    usageSectionLabels: { primary: "5 hours", secondary: "Weekly" },
    dashboardUrl: "https://dev.meta.ai",
    subscriptionDashboardUrl: "https://dev.meta.ai",
  },
  aliases: ["muse-code"],
  mock: { source: "api" },
};

export default muse;
