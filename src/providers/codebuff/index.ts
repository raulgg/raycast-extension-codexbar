import type { ProviderModule } from "../module";

const codebuff: ProviderModule = {
  metadata: {
    name: "Codebuff",
    iconSlug: "codebuff",
    iconFallback: "Code",
    brandColor: "#44FF00",
    usageSectionLabels: { primary: "Credits", secondary: "Weekly" },
    dashboardUrl: "https://www.codebuff.com/usage",
  },
  aliases: ["manicode"],
  mock: { source: "api" },
};

export default codebuff;
