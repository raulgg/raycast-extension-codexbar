import type { ProviderModule } from "../module";
import { build } from "./mock";
import { interpret } from "./usageCard";

const kilo: ProviderModule = {
  metadata: {
    name: "Kilo",
    iconSlug: "kilo",
    iconFallback: "BarChart",
    brandColor: "#F27027",
    usageSectionLabels: { primary: "Credits", secondary: "Kilo Pass" },
    dashboardUrl: "https://app.kilo.ai/usage",
  },
  aliases: ["kilo-ai"],
  mock: { build },
  interpret,
};

export default kilo;
