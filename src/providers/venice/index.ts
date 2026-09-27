import type { ProviderModule } from "../module";

const venice: ProviderModule = {
  metadata: {
    name: "Venice",
    iconSlug: "venice",
    iconFallback: "Globe",
    brandColor: "#3399FF",
    usageSectionLabels: { primary: "Balance", secondary: "Balance" },
    dashboardUrl: "https://venice.ai/settings/api",
  },
  aliases: ["ven"],
  mock: { source: "api" },
};

export default venice;
