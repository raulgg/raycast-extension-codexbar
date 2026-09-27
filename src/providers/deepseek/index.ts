import type { ProviderModule } from "../module";

const deepseek: ProviderModule = {
  metadata: {
    name: "DeepSeek",
    iconSlug: "deepseek",
    brandColor: "#527DF0",
    usageSectionLabels: { primary: "Balance", secondary: "Balance" },
    dashboardUrl: "https://platform.deepseek.com/usage",
    statusPageUrl: "https://status.deepseek.com",
  },
  aliases: ["deep-seek", "ds"],
  mock: { source: "api" },
};

export default deepseek;
