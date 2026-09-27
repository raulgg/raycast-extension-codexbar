import type { ProviderModule } from "../module";

const llmproxy: ProviderModule = {
  metadata: {
    name: "LLM Proxy",
    iconSlug: "llmproxy",
    iconFallback: "Network",
    brandColor: "#24B47E",
    usageSectionLabels: { primary: "Quota", secondary: "Requests" },
  },
  aliases: ["llm-api-key-proxy", "llm-proxy"],
  mock: { source: "api" },
};

export default llmproxy;
