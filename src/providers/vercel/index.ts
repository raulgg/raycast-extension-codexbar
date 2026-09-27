import type { ProviderModule } from "../module";

const vercel: ProviderModule = {
  metadata: {
    name: "Vercel AI Gateway",
    iconSlug: "vercel",
    iconFallback: "Globe",
    brandColor: "#FFFFFF",
    usageSectionLabels: { primary: "Balance", secondary: "Balance" },
    dashboardUrl: "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway",
  },
  mock: { source: "api" },
};

export default vercel;
