import type { ProviderModule } from "../module";

const coderabbit: ProviderModule = {
  metadata: {
    name: "CodeRabbit",
    iconSlug: "coderabbit",
    iconFallback: "Code",
    brandColor: "#FF5C35",
    usageSectionLabels: { primary: "Reviews", secondary: "Billing" },
    dashboardUrl: "https://app.coderabbit.ai",
    statusPageUrl: "https://status.coderabbit.ai",
  },
  mock: { source: "api" },
};

export default coderabbit;
