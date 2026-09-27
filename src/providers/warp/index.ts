import type { ProviderModule } from "../module";
import { build } from "./mock";

const warp: ProviderModule = {
  metadata: {
    name: "Warp",
    iconSlug: "warp",
    iconFallback: "ArrowRightCircle",
    brandColor: "#938BB4",
    usageSectionLabels: { primary: "Credits", secondary: "Add-on credits" },
    dashboardUrl: "https://docs.warp.dev/reference/cli/api-keys",
  },
  aliases: ["warp-ai", "warp-terminal"],
  mock: { build },
};

export default warp;
