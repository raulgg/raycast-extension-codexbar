import type { ProviderModule } from "../module";
import { build } from "./mock";

const notion: ProviderModule = {
  metadata: {
    name: "Notion AI",
    iconSlug: "notion",
    iconFallback: "AppWindow",
    brandColor: "#337EA9",
    usageSectionLabels: { primary: "Rolling", secondary: "Monthly" },
    dashboardUrl: "https://app.notion.com/",
    statusPageUrl: "https://status.notion.so/",
  },
  aliases: ["notion-ai", "notionai"],
  pace: {
    resetWindowPace: { type: "windowDuration", minutes: 30 * 24 * 60 },
    inferredMonthlyDuration: { type: "windowDuration", minutes: 30 * 24 * 60 },
    sessionPaceWindowRule: { type: "windowDurationAtMost", minutes: 360 },
  },
  mock: { build },
};

export default notion;
