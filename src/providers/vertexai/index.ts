import type { ProviderModule } from "../module";
import { build } from "./mock";

const vertexai: ProviderModule = {
  metadata: {
    name: "Vertex AI",
    iconSlug: "vertexai",
    iconFallback: "Globe",
    brandColor: "#4285F4",
    usageSectionLabels: { primary: "Requests", secondary: "Tokens" },
    dashboardUrl: "https://console.cloud.google.com/vertex-ai",
    statusPageUrl: "https://status.cloud.google.com",
  },
  mock: { build },
};

export default vertexai;
