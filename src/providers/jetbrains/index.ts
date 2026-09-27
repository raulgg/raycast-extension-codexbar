import type { ProviderModule } from "../module";
import { build } from "./mock";

const jetbrains: ProviderModule = {
  metadata: {
    name: "JetBrains AI",
    iconSlug: "jetbrains",
    iconFallback: "AppWindow",
    brandColor: "#FF3399",
    usageSectionLabels: { primary: "Current", secondary: "Refill" },
  },
  mock: { build },
};

export default jetbrains;
