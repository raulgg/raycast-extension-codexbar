import type { ProviderModule } from "../module";

const bedrock: ProviderModule = {
  metadata: {
    name: "AWS Bedrock",
    iconSlug: "bedrock",
    iconFallback: "Cloud",
    brandColor: "#FF9900",
    usageSectionLabels: { primary: "Budget", secondary: "Cost" },
    dashboardUrl: "https://console.aws.amazon.com/bedrock",
    statusPageUrl: "https://health.aws.amazon.com/health/status",
  },
  aliases: ["aws-bedrock"],
  mock: { source: "oauth" },
};

export default bedrock;
