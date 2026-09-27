import type { ProviderModule } from "../module";
import { displayTitle } from "./usageCard";

const qwencloud: ProviderModule = {
  metadata: {
    name: "Qwen Cloud",
    iconSlug: "qwencloud",
    iconFallback: "Globe",
    brandColor: "#615CED",
    usageSectionLabels: { primary: "5-hour", secondary: "Weekly" },
    dashboardUrl: "https://home.qwencloud.com/billing/subscription/token-plan-individual",
    statusPageUrl: "https://status.alibabacloud.com",
  },
  aliases: ["qwen-cloud", "qwen", "qwen-token-plan"],
  mock: { source: "web" },
  displayTitle,
};

export default qwencloud;
