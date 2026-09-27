import type { ProviderModule } from "../module";

const zed: ProviderModule = {
  metadata: {
    name: "Zed",
    iconSlug: "zed",
    iconFallback: "AppWindow",
    brandColor: "#084EFF",
    usageSectionLabels: { primary: "Edit predictions", secondary: "Billing cycle" },
  },
  mock: { source: "local" },
};

export default zed;
