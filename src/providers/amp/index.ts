import type { ProviderModule } from "../module";
import { build } from "./mock";
import { displayTitle } from "./usageCard";

function ampRenewsInDescription(window: {
  windowMinutes?: number;
  resetsAt?: string;
  resetDescription?: string;
}): boolean {
  return window.windowMinutes !== undefined && (window.resetDescription?.startsWith("renews in ") ?? false);
}

const amp: ProviderModule = {
  metadata: {
    name: "Amp",
    iconSlug: "amp",
    iconFallback: "Bolt",
    brandColor: "#DC2626",
    usageSectionLabels: { primary: "Amp Free", secondary: "Balance" },
    dashboardUrl: "https://ampcode.com/settings/usage",
  },
  pace: {
    resetWindowPace: { type: "predicate", id: "ampRenewsInDescription", matches: ampRenewsInDescription },
    inferredMonthlyDuration: { type: "unsupported" },
    sessionPaceWindowRule: { type: "unsupported" },
  },
  mock: { build },
  displayTitle,
};

export default amp;
