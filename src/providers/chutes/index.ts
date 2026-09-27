import type { ProviderModule } from "../module";

const chutes: ProviderModule = {
  metadata: {
    name: "Chutes",
    iconSlug: "chutes",
    iconFallback: "Bolt",
    brandColor: "#3184FF",
    usageSectionLabels: { primary: "4-hour quota", secondary: "Monthly quota" },
    dashboardUrl: "https://chutes.ai",
  },
  aliases: ["chutes.ai"],
  mock: { source: "api" },
};

export default chutes;
