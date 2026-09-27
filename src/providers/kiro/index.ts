import type { ProviderModule } from "../module";
import { build } from "./mock";

const kiro: ProviderModule = {
  metadata: {
    name: "Kiro",
    iconSlug: "kiro",
    brandColor: "#FF9900",
    usageSectionLabels: { primary: "Credits", secondary: "Bonus" },
    dashboardUrl: "https://app.kiro.dev/account/usage",
    statusPageUrl: "https://health.aws.amazon.com/health/status",
  },
  aliases: ["kiro-cli"],
  mock: { build },
};

export default kiro;
