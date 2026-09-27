import type { ProviderModule } from "../module";
import { displayTitle } from "./usageCard";

const stepfun: ProviderModule = {
  metadata: {
    name: "StepFun",
    iconSlug: "stepfun",
    brandColor: "#2196F2",
    usageSectionLabels: { primary: "5h Window", secondary: "Weekly Window" },
    dashboardUrl: "https://platform.stepfun.com/plan-usage",
  },
  aliases: ["step-fun", "sf"],
  pace: {
    resetWindowPace: { type: "windowDuration", minutes: 30 * 24 * 60 },
    inferredMonthlyDuration: { type: "windowDuration", minutes: 30 * 24 * 60 },
    sessionPaceWindowRule: { type: "unsupported" },
  },
  mock: { source: "web" },
  displayTitle,
};

export default stepfun;
