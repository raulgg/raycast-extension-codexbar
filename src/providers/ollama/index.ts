import type { ProviderModule } from "../module";
import { build } from "./mock";
import { displayTitle } from "./usageCard";

const ollama: ProviderModule = {
  metadata: {
    name: "Ollama",
    iconSlug: "ollama",
    iconFallback: "Box",
    brandColor: "#888888",
    usageSectionLabels: { primary: "Session", secondary: "Weekly" },
    dashboardUrl: "https://ollama.com/settings",
  },
  pace: {
    resetWindowPace: { type: "windowDuration", minutes: 30 * 24 * 60 },
    inferredMonthlyDuration: { type: "windowDuration", minutes: 30 * 24 * 60 },
    sessionPaceWindowRule: { type: "windowDurationAtMost", minutes: 300 },
  },
  mock: { build },
  displayTitle,
};

export default ollama;
