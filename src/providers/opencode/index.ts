import type { ProviderModule } from "../module";
import { build } from "./mock";

const opencode: ProviderModule = {
  metadata: {
    name: "OpenCode",
    iconSlug: "opencode",
    iconFallback: "Code",
    brandColor: "#3B82F6",
    usageSectionLabels: { primary: "5-hour", secondary: "Weekly" },
    dashboardUrl: "https://opencode.ai/auth",
  },
  mock: { build },
};

export default opencode;
