import type { ProviderModule } from "../module";
import { build } from "./mock";
import { interpret } from "./usageCard";

const antigravity: ProviderModule = {
  metadata: {
    name: "Antigravity",
    iconSlug: "antigravity",
    brandColor: "#60BA7E",
    usageSectionLabels: { primary: "Gemini Models", secondary: "Claude and GPT" },
    statusPageUrl: "https://www.google.com/appsstatus/dashboard/products/npdyhgECDJ6tB66MxXyo/history",
  },
  pace: {
    resetWindowPace: { type: "unsupported" },
    inferredMonthlyDuration: { type: "unsupported" },
    sessionPaceWindowRule: { type: "windowDuration", minutes: 300 },
  },
  extraWindowPace: "session-or-weekly",
  mock: { build },
  interpret,
};

export default antigravity;
