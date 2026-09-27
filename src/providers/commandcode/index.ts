import type { ProviderModule } from "../module";

const commandcode: ProviderModule = {
  metadata: {
    name: "Command Code",
    iconSlug: "commandcode",
    iconFallback: "Terminal",
    brandColor: "#A04DFD",
    usageSectionLabels: { primary: "5-hour", secondary: "Weekly", tertiary: "Monthly" },
    dashboardUrl: "https://commandcode.ai/studio",
    subscriptionDashboardUrl: "https://commandcode.ai/settings/billing",
  },
  aliases: ["command-code"],
  pace: {
    resetWindowPace: { type: "windowDuration", minutes: 30 * 24 * 60 },
    inferredMonthlyDuration: { type: "windowDuration", minutes: 30 * 24 * 60 },
    sessionPaceWindowRule: { type: "unsupported" },
  },
  mock: { source: "web" },
};

export default commandcode;
