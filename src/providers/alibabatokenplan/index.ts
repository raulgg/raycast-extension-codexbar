import type { ProviderModule } from "../module";
import { displayTitle } from "./usageCard";

const alibabatokenplan: ProviderModule = {
  metadata: {
    name: "Alibaba Token Plan",
    iconSlug: "alibaba",
    brandColor: "#FF6A00",
    usageSectionLabels: { primary: "Credits", secondary: "Usage" },
    dashboardUrl: "https://bailian.console.aliyun.com/cn-beijing?tab=plan#/efm/subscription/token-plan",
    statusPageUrl: "https://status.aliyun.com",
  },
  aliases: ["alibaba-token-plan", "alibaba-token", "bailian-token-plan"],
  pace: {
    resetWindowPace: { type: "windowDuration", minutes: 30 * 24 * 60 },
    inferredMonthlyDuration: { type: "windowDuration", minutes: 30 * 24 * 60 },
    sessionPaceWindowRule: { type: "unsupported" },
  },
  mock: { source: "web" },
  displayTitle,
};

export default alibabatokenplan;
