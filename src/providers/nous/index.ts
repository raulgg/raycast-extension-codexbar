import type { ProviderModule } from "../module";

const nous: ProviderModule = {
  metadata: {
    name: "Nous Portal",
    iconSlug: "nous",
    iconFallback: "Stars",
    brandColor: "#D6A55C",
    usageSectionLabels: { primary: "Monthly credits", secondary: "Weekly" },
    dashboardUrl: "https://portal.nousresearch.com/usage",
    subscriptionDashboardUrl: "https://portal.nousresearch.com/manage-subscription",
  },
  aliases: ["nous-portal", "hermes"],
  mock: { source: "api" },
};

export default nous;
