import type { ProviderModule } from "../module";
import { build } from "./mock";
import { displayTitle } from "./usageCard";
import { grokWeeklyCredits } from "./window";

const grok: ProviderModule = {
  metadata: {
    name: "Grok",
    iconSlug: "grok",
    iconFallback: "Stars",
    brandColor: "#10A37F",
    usageSectionLabels: { primary: "Credits", secondary: "On-demand" },
    dashboardUrl: "https://grok.com/?_s=usage",
    statusPageUrl: "https://status.x.ai",
  },
  pace: {
    resetWindowPace: { type: "predicate", id: "grokWeeklyCredits", matches: grokWeeklyCredits },
    inferredMonthlyDuration: { type: "unsupported" },
    sessionPaceWindowRule: { type: "unsupported" },
  },
  mock: { build },
  displayTitle,
};

export default grok;
