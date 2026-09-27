import type { ProviderModule } from "../module";
import { build } from "./mock";

const perplexity: ProviderModule = {
  metadata: {
    name: "Perplexity",
    iconSlug: "perplexity",
    iconFallback: "Globe",
    brandColor: "#20B2AA",
    usageSectionLabels: { primary: "Credits", secondary: "Bonus credits", tertiary: "Purchased" },
    dashboardUrl: "https://www.perplexity.ai/account/usage",
    statusPageUrl: "https://status.perplexity.com/",
  },
  mock: { build },
};

export default perplexity;
