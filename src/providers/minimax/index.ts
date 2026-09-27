import type { ProviderModule } from "../module";
import { build } from "./mock";

const minimax: ProviderModule = {
  metadata: {
    name: "MiniMax",
    iconSlug: "minimax",
    brandColor: "#FE603C",
    usageSectionLabels: { primary: "Prompts", secondary: "Window" },
    dashboardUrl: "https://platform.minimax.io/user-center/payment/coding-plan?cycle_type=3",
  },
  aliases: ["mini-max"],
  mock: { build },
};

export default minimax;
