import type { ProviderModule } from "../module";

const azureopenai: ProviderModule = {
  metadata: {
    name: "Azure OpenAI",
    iconSlug: "codex",
    iconFallback: "Terminal",
    brandColor: "#0078D4",
    usageSectionLabels: { primary: "Status", secondary: "Deployment" },
    dashboardUrl: "https://ai.azure.com",
    statusPageUrl: "https://azure.status.microsoft/en-us/status",
  },
  aliases: ["azure-openai", "aoai"],
  mock: { source: "api" },
};

export default azureopenai;
