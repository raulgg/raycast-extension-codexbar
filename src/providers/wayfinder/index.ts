import type { ProviderModule } from "../module";

const wayfinder: ProviderModule = {
  metadata: {
    name: "Wayfinder",
    iconSlug: "wayfinder",
    iconFallback: "Globe",
    brandColor: "#10A37F",
    usageSectionLabels: { primary: "Savings", secondary: "Requests" },
    dashboardUrl: "http://127.0.0.1:8088/router",
  },
  aliases: ["wayfinder-router"],
  mock: { source: "api" },
};

export default wayfinder;
