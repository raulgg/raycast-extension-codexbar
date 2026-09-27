import type { ProviderModule } from "../module";
import { build } from "./mock";
import { displayTitle } from "./usageCard";

const factory: ProviderModule = {
  metadata: {
    name: "Droid",
    iconSlug: "factory",
    brandColor: "#FF6B35",
    usageSectionLabels: { primary: "Standard", secondary: "Premium" },
    dashboardUrl: "https://app.factory.ai/settings/billing",
    statusPageUrl: "https://status.factory.ai",
  },
  mock: { build },
  displayTitle,
};

export default factory;
