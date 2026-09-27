import type { ProviderModule } from "../module";

const fireworks: ProviderModule = {
  metadata: {
    name: "Fireworks",
    iconSlug: "fireworks",
    iconFallback: "Bolt",
    brandColor: "#F25B1C",
    usageSectionLabels: { primary: "Spend", secondary: "Spend" },
    dashboardUrl: "https://app.fireworks.ai",
  },
  aliases: ["fw"],
  mock: { source: "api" },
};

export default fireworks;
