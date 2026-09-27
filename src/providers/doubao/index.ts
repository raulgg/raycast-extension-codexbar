import type { ProviderModule } from "../module";
import { displayTitle } from "./usageCard";

const doubao: ProviderModule = {
  metadata: {
    name: "Doubao",
    iconSlug: "doubao",
    brandColor: "#3370FF",
    usageSectionLabels: { primary: "5-hour", secondary: "Weekly", tertiary: "Monthly" },
    dashboardUrl:
      "https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?LLM=%7B%7D&advancedActiveKey=subscribe",
  },
  aliases: ["volcengine", "ark", "bytedance"],
  pace: {
    resetWindowPace: { type: "windowDuration", minutes: 30 * 24 * 60 },
    inferredMonthlyDuration: { type: "windowDuration", minutes: 30 * 24 * 60 },
    sessionPaceWindowRule: { type: "unsupported" },
  },
  mock: { source: "web" },
  displayTitle,
};

export default doubao;
