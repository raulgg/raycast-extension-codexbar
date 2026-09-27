import type { ProviderModule } from "../module";

const litellm: ProviderModule = {
  metadata: {
    name: "LiteLLM",
    iconSlug: "litellm",
    iconFallback: "Network",
    brandColor: "#4C89F0",
    usageSectionLabels: { primary: "Personal budget", secondary: "Team budget" },
  },
  aliases: ["litellm-proxy"],
  mock: { source: "api" },
};

export default litellm;
