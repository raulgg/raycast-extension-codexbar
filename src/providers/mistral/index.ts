import type { ProviderModule } from "../module";
import { displayTitle } from "./usageCard";

const mistral: ProviderModule = {
  metadata: {
    name: "Mistral",
    iconSlug: "mistral",
    iconFallback: "Bolt",
    brandColor: "#FF500F",
    usageSectionLabels: { primary: "Balance" },
    dashboardUrl: "https://admin.mistral.ai/organization/usage",
    statusPageUrl: "https://status.mistral.ai",
  },
  aliases: ["mistral-ai"],
  mock: { source: "web", windowCount: 1 },
  displayTitle,
};

export default mistral;
