import type { ProviderModule } from "../module";
import { dashboardUrl } from "./usageCard";

const HELMCODE_DASHBOARD_URL = "https://cloud.helmcode.com/dashboard";

const helmcode: ProviderModule = {
  metadata: {
    name: "Helmcode",
    iconSlug: "helmcode",
    iconFallback: "Terminal",
    brandColor: "#4934E1",
    usageSectionLabels: { primary: "Model quota", secondary: "Model quota" },
    dashboardUrl: HELMCODE_DASHBOARD_URL,
  },
  aliases: ["helm-code"],
  mock: { source: "api" },
  dashboardUrl: dashboardUrl(HELMCODE_DASHBOARD_URL),
};

export default helmcode;
