import type { ProviderModule } from "../module";
import { build } from "./mock";

const synthetic: ProviderModule = {
  metadata: {
    name: "Synthetic",
    iconSlug: "synthetic",
    brandColor: "#141414",
    usageSectionLabels: { primary: "Five-hour quota", secondary: "Weekly tokens", tertiary: "Search hourly" },
  },
  aliases: ["synthetic.new"],
  mock: { build },
};

export default synthetic;
