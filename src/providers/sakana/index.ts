import type { ProviderModule } from "../module";

const sakana: ProviderModule = {
  metadata: {
    name: "Sakana AI",
    iconSlug: "sakana",
    brandColor: "#2975DB",
    usageSectionLabels: { primary: "5-hour", secondary: "Weekly" },
    dashboardUrl: "https://console.sakana.ai/billing",
  },
  aliases: ["sakana-ai"],
  mock: { source: "web" },
};

export default sakana;
