import type { ProviderModule } from "../module";
import { build } from "./mock";
import { displayTitle, interpret } from "./usageCard";

function codexSessionRejectsWeeklyMonthly(window: {
  windowMinutes?: number;
  resetsAt?: string;
  resetDescription?: string;
}): boolean {
  if (window.windowMinutes === undefined) {
    return true;
  }

  return window.windowMinutes !== 7 * 24 * 60 && window.windowMinutes !== 30 * 24 * 60;
}

const codex: ProviderModule = {
  metadata: {
    name: "Codex",
    iconSlug: "codex",
    iconFallback: "Terminal",
    brandColor: "#49A3B0",
    usageSectionLabels: { primary: "Session", secondary: "Weekly" },
    dashboardUrl: "https://chatgpt.com/codex/settings/usage",
    statusPageUrl: "https://status.openai.com/",
  },
  pace: {
    resetWindowPace: { type: "unsupported" },
    inferredMonthlyDuration: { type: "unsupported" },
    sessionPaceWindowRule: {
      type: "predicate",
      id: "codexSessionRejectsWeeklyMonthly",
      matches: codexSessionRejectsWeeklyMonthly,
    },
    secondaryAllowsDefaultWindow: true,
  },
  extraWindowPace: "session-or-weekly",
  mock: { build },
  displayTitle,
  interpret,
};

export default codex;
