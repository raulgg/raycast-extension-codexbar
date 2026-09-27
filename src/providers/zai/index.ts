import type { ProviderModule } from "../module";
import { build } from "./mock";

const MONTHLY_WINDOW_SENTINEL_MINUTES = 30 * 24 * 60;

function zaiMonthlyMcp(window: { windowMinutes?: number; resetsAt?: string; resetDescription?: string }): boolean {
  return window.windowMinutes === MONTHLY_WINDOW_SENTINEL_MINUTES && window.resetDescription === "MCP";
}

const zai: ProviderModule = {
  metadata: {
    name: "z.ai / GLM",
    iconSlug: "zai",
    iconFallback: "Globe",
    brandColor: "#E85A6A",
    usageSectionLabels: { primary: "5-hour", secondary: "Weekly" },
    dashboardUrl: "https://z.ai/manage-apikey/coding-plan/personal/my-plan",
  },
  aliases: ["z.ai"],
  pace: {
    resetWindowPace: { type: "predicate", id: "zaiMonthlyMcp", matches: zaiMonthlyMcp },
    inferredMonthlyDuration: { type: "predicate", id: "zaiMonthlyMcp", matches: zaiMonthlyMcp },
    sessionPaceWindowRule: { type: "windowDuration", minutes: 300 },
  },
  mock: { build },
};

export default zai;
