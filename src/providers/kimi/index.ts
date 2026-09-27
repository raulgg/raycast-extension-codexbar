import type { ProviderModule } from "../module";
import { build } from "./mock";

const kimi: ProviderModule = {
  metadata: {
    name: "Kimi Code",
    iconSlug: "kimi",
    brandColor: "#FE603C",
    usageSectionLabels: { primary: "7-day usage", secondary: "5-hour usage" },
    dashboardUrl: "https://www.kimi.com/code/console",
  },
  aliases: ["kimi-ai"],
  pace: {
    resetWindowPace: { type: "windowDuration", minutes: 10_080 },
    inferredMonthlyDuration: { type: "unsupported" },
    sessionPaceWindowRule: { type: "windowDuration", minutes: 300 },
    secondarySessionPace: true,
  },
  mock: { build },
};

export default kimi;
