import type { ProviderModule } from "../module";

const mimo: ProviderModule = {
  metadata: {
    name: "Xiaomi MiMo",
    iconSlug: "mimo",
    brandColor: "#FF6900",
    usageSectionLabels: { primary: "Credits", secondary: "Window" },
    dashboardUrl: "https://platform.xiaomimimo.com/#/console/balance",
  },
  aliases: ["xiaomi-mimo"],
  pace: {
    resetWindowPace: { type: "windowDuration", minutes: 30 * 24 * 60 },
    inferredMonthlyDuration: { type: "windowDuration", minutes: 30 * 24 * 60 },
    sessionPaceWindowRule: { type: "unsupported" },
  },
  mock: { source: "web" },
};

export default mimo;
