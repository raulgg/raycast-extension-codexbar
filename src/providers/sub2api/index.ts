import type { ProviderModule } from "../module";
import { displayTitle } from "./usageCard";

const sub2api: ProviderModule = {
  metadata: {
    name: "sub2api",
    iconSlug: "sub2api",
    iconFallback: "Network",
    brandColor: "#2DC6D8",
    usageSectionLabels: { primary: "Quota", secondary: "Weekly quota", tertiary: "Monthly quota" },
  },
  aliases: ["sub-2-api"],
  mock: { source: "api" },
  displayTitle,
};

export default sub2api;
