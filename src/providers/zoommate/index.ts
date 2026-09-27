import type { ProviderModule } from "../module";

const zoommate: ProviderModule = {
  metadata: {
    name: "ZoomMate",
    iconSlug: "zoommate",
    iconFallback: "TwoPeople",
    brandColor: "#0B5CFF",
    usageSectionLabels: { primary: "Credits", secondary: "Credits" },
    dashboardUrl: "https://zoommate.zoom.us/#/?settings=credit-usage",
    statusPageUrl: "https://www.zoomstatus.com/",
  },
  mock: { source: "web" },
};

export default zoommate;
