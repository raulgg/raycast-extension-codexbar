import type { ProviderModule } from "../module";

const t3chat: ProviderModule = {
  metadata: {
    name: "T3 Chat",
    iconSlug: "t3chat",
    iconFallback: "Bubble",
    brandColor: "#F56647",
    usageSectionLabels: { primary: "Base", secondary: "Overage" },
    dashboardUrl: "https://t3.chat/settings/customization",
    subscriptionDashboardUrl: "https://t3.chat/settings/subscription",
  },
  aliases: ["t3-chat", "t3"],
  mock: { source: "web" },
};

export default t3chat;
