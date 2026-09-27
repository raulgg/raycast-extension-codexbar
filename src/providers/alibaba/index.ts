import type { ProviderModule } from "../module";
import { build } from "./mock";

const alibaba: ProviderModule = {
  metadata: {
    name: "Alibaba",
    iconSlug: "alibaba",
    brandColor: "#FF6A00",
    usageSectionLabels: { primary: "5-hour", secondary: "Weekly", tertiary: "Monthly" },
    dashboardUrl: "https://modelstudio.console.alibabacloud.com/ap-southeast-1/?tab=coding-plan#/efm/coding_plan",
    statusPageUrl: "https://status.aliyun.com",
  },
  aliases: ["alibaba-coding-plan", "bailian"],
  pace: {
    resetWindowPace: { type: "windowDuration", minutes: 30 * 24 * 60 },
    inferredMonthlyDuration: { type: "windowDuration", minutes: 30 * 24 * 60 },
    sessionPaceWindowRule: { type: "unsupported" },
  },
  mock: { build },
};

export default alibaba;
