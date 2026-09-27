import type { ProviderModule } from "../module";
import { build } from "./mock";

const opencodego: ProviderModule = {
  metadata: {
    name: "OpenCode Go",
    iconSlug: "opencodego",
    iconFallback: "Code",
    brandColor: "#3B82F6",
    usageSectionLabels: { primary: "5-hour", secondary: "Weekly", tertiary: "Monthly" },
    dashboardUrl: "https://opencode.ai/auth",
  },
  pace: {
    resetWindowPace: { type: "windowDuration", minutes: 30 * 24 * 60 },
    inferredMonthlyDuration: { type: "windowDuration", minutes: 30 * 24 * 60 },
    sessionPaceWindowRule: { type: "unsupported" },
    allowsEstimatedUsage: false,
  },
  mock: { build },
};

export default opencodego;
