import type { ProviderModule } from "../module";

const gitkraken: ProviderModule = {
  metadata: {
    name: "GitKraken AI",
    iconSlug: "gitkraken",
    iconFallback: "Code",
    brandColor: "#179287",
    usageSectionLabels: { primary: "Personal", secondary: "Shared pool" },
    dashboardUrl: "https://gitkraken.dev/account#ai-usage",
  },
  aliases: ["gk"],
  mock: { source: "api" },
};

export default gitkraken;
