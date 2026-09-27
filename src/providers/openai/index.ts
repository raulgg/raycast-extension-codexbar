import type { ProviderModule } from "../module";

const openai: ProviderModule = {
  metadata: {
    name: "OpenAI",
    iconSlug: "codex",
    iconFallback: "Terminal",
    brandColor: "#0F826E",
    usageSectionLabels: { primary: "Spend", secondary: "Requests" },
    dashboardUrl: "https://platform.openai.com/usage",
    statusPageUrl: "https://status.openai.com",
  },
  aliases: ["openai-api"],
  mock: { source: "api" },
};

export default openai;
