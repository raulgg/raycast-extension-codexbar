import type { ProviderModule } from "../module";

const clawrouter: ProviderModule = {
  metadata: {
    name: "ClawRouter",
    iconSlug: "clawrouter",
    iconFallback: "Network",
    brandColor: "#596EF6",
    usageSectionLabels: { primary: "Monthly budget", secondary: "Requests" },
    dashboardUrl: "https://clawrouter.openclaw.ai/dashboard/access",
  },
  aliases: ["claw-router"],
  mock: { source: "api" },
};

export default clawrouter;
