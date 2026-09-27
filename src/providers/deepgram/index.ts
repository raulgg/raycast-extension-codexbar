import type { ProviderModule } from "../module";

const deepgram: ProviderModule = {
  metadata: {
    name: "Deepgram",
    iconSlug: "deepgram",
    iconFallback: "Microphone",
    brandColor: "#6467F2",
    usageSectionLabels: { primary: "Requests", secondary: "Usage" },
    dashboardUrl: "https://console.deepgram.com/project/",
    statusPageUrl: "https://status.deepgram.com",
  },
  aliases: ["dg"],
  mock: { source: "api" },
};

export default deepgram;
