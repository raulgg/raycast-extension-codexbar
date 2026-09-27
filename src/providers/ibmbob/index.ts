import type { ProviderModule } from "../module";

const ibmbob: ProviderModule = {
  metadata: {
    name: "IBM Bob",
    iconSlug: "ibmbob",
    iconFallback: "Terminal",
    brandColor: "#0E61FA",
    usageSectionLabels: { primary: "Monthly Bobcoins", secondary: "Monthly Bobcoins" },
    dashboardUrl: "https://bob.ibm.com",
    subscriptionDashboardUrl: "https://bob.ibm.com",
    statusPageUrl: "https://status.bob.ibm.com",
  },
  aliases: ["ibm-bob", "bob", "bobshell"],
  mock: { source: "api" },
};

export default ibmbob;
