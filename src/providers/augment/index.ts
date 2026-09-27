import type { ProviderModule } from "../module";
import { build } from "./mock";

const augment: ProviderModule = {
  metadata: {
    name: "Augment",
    iconSlug: "augment",
    iconFallback: "Bolt",
    brandColor: "#6366F1",
    usageSectionLabels: { primary: "Credits", secondary: "Usage" },
    dashboardUrl: "https://app.augmentcode.com/account/subscription",
    statusPageUrl: "https://status.augmentcode.com",
  },
  mock: { build },
};

export default augment;
