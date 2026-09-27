import type { ProviderModule } from "../module";
import { build } from "./mock";
import { dashboardUrl, interpret } from "./usageCard";

const CONSOLE_DASHBOARD_URL = "https://console.anthropic.com/settings/billing";
const SUBSCRIPTION_DASHBOARD_URL = "https://claude.ai/settings/usage";

const claude: ProviderModule = {
  metadata: {
    name: "Claude",
    iconSlug: "claude",
    iconFallback: "Bubble",
    brandColor: "#CC7C5E",
    usageSectionLabels: { primary: "Session", secondary: "Weekly", tertiary: "Sonnet" },
    dashboardUrl: CONSOLE_DASHBOARD_URL,
    subscriptionDashboardUrl: SUBSCRIPTION_DASHBOARD_URL,
    statusPageUrl: "https://status.claude.com/",
  },
  pace: {
    resetWindowPace: { type: "unsupported" },
    inferredMonthlyDuration: { type: "unsupported" },
    sessionPaceWindowRule: { type: "always" },
  },
  extraWindowPace: "weekly-only",
  mock: { build },
  dashboardUrl: dashboardUrl(CONSOLE_DASHBOARD_URL, SUBSCRIPTION_DASHBOARD_URL),
  interpret,
};

export default claude;
