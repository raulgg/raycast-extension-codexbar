import type { ProviderModule } from "../module";

const deepinfra: ProviderModule = {
  metadata: {
    name: "DeepInfra",
    iconSlug: "deepinfra",
    iconFallback: "Cloud",
    brandColor: "#2A3275",
    usageSectionLabels: { primary: "Balance", secondary: "Balance" },
    dashboardUrl: "https://deepinfra.com/dash",
    statusPageUrl: "https://status.deepinfra.com",
  },
  aliases: ["deep-infra", "di"],
  mock: { source: "api" },
};

export default deepinfra;
