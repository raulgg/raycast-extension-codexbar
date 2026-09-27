import type { ProviderModule } from "../module";

const abacus: ProviderModule = {
  metadata: {
    name: "Abacus AI",
    iconSlug: "abacus",
    iconFallback: "BarChart",
    brandColor: "#38BDF8",
    usageSectionLabels: { primary: "Credits", secondary: "Weekly" },
    dashboardUrl: "https://apps.abacus.ai/chatllm/admin/compute-points-usage",
  },
  aliases: ["abacusai", "abacus-ai"],
  mock: { source: "web" },
};

export default abacus;
