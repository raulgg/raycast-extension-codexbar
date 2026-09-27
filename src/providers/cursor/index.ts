import type { ProviderModule } from "../module";
import { build } from "./mock";

const cursor: ProviderModule = {
  metadata: {
    name: "Cursor",
    iconSlug: "cursor",
    iconFallback: "ArrowRightCircle",
    brandColor: "#00BFA5",
    usageSectionLabels: { primary: "Total", secondary: "Cursor", tertiary: "Third Party" },
    dashboardUrl: "https://cursor.com/dashboard?tab=usage",
    statusPageUrl: "https://status.cursor.com",
  },
  pace: {
    resetWindowPace: { type: "windowDurationPresent" },
    inferredMonthlyDuration: { type: "unsupported" },
    sessionPaceWindowRule: { type: "unsupported" },
  },
  extraWindowPace: "weekly-only",
  mock: { build },
};

export default cursor;
