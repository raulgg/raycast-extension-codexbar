import type { ProviderModule } from "../module";
import { build } from "./mock";
import { interpret } from "./usageCard";

const openrouter: ProviderModule = {
  metadata: {
    name: "OpenRouter",
    iconSlug: "openrouter",
    iconFallback: "TwoPeople",
    brandColor: "#6467F2",
    usageSectionLabels: { primary: "Credits", secondary: "Usage" },
    dashboardUrl: "https://openrouter.ai/activity",
    statusPageUrl: "https://status.openrouter.ai",
  },
  aliases: ["or"],
  mock: { build },
  interpret,
};

export default openrouter;
