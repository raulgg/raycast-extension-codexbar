import type { ProviderModule } from "../module";

const windsurf: ProviderModule = {
  metadata: {
    name: "Windsurf",
    iconSlug: "windsurf",
    iconFallback: "Code",
    brandColor: "#34E8BB",
    usageSectionLabels: { primary: "Daily", secondary: "Weekly" },
    dashboardUrl: "https://windsurf.com/subscription/usage",
  },
  mock: { source: "web" },
};

export default windsurf;
