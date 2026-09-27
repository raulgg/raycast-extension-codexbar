import type { ProviderModule } from "../module";

const groq: ProviderModule = {
  metadata: {
    name: "Groq",
    iconSlug: "groq",
    iconFallback: "Bolt",
    brandColor: "#F56844",
    usageSectionLabels: { primary: "Requests", secondary: "Tokens" },
    dashboardUrl: "https://console.groq.com/dashboard/usage",
    statusPageUrl: "https://status.groq.com",
  },
  aliases: ["groqcloud", "groq-api"],
  mock: { source: "api" },
};

export default groq;
