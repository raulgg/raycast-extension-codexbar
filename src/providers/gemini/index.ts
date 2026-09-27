import type { ProviderModule } from "../module";
import { build } from "./mock";

const gemini: ProviderModule = {
  metadata: {
    name: "Gemini",
    iconSlug: "gemini",
    iconFallback: "Bolt",
    brandColor: "#AB87EA",
    usageSectionLabels: { primary: "Pro", secondary: "Flash", tertiary: "Flash Lite" },
    dashboardUrl: "https://gemini.google.com",
    statusPageUrl: "https://www.google.com/appsstatus/dashboard/products/npdyhgECDJ6tB66MxXyo/history",
  },
  mock: { build },
};

export default gemini;
