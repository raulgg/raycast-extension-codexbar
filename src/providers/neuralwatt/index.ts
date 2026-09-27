import type { ProviderModule } from "../module";

const neuralwatt: ProviderModule = {
  metadata: {
    name: "Neuralwatt",
    iconSlug: "neuralwatt",
    iconFallback: "Bolt",
    brandColor: "#38D98C",
    usageSectionLabels: { primary: "Subscription", secondary: "Key allowance" },
    dashboardUrl: "https://portal.neuralwatt.com/dashboard",
    subscriptionDashboardUrl: "https://portal.neuralwatt.com/dashboard",
  },
  aliases: ["nw", "neural"],
  mock: { source: "api" },
};

export default neuralwatt;
