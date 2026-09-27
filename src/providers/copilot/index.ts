import type { ProviderModule } from "../module";
import { build } from "./mock";

const copilot: ProviderModule = {
  metadata: {
    name: "Copilot",
    iconSlug: "copilot",
    iconFallback: "Person",
    brandColor: "#A855F7",
    usageSectionLabels: { primary: "Premium", secondary: "Chat" },
    dashboardUrl: "https://github.com/settings/copilot",
    statusPageUrl: "https://www.githubstatus.com/",
  },
  pace: {
    resetWindowPace: { type: "resetDatePresent" },
    inferredMonthlyDuration: { type: "windowDurationMissing" },
    sessionPaceWindowRule: { type: "unsupported" },
  },
  mock: { build },
};

export default copilot;
