import type { ProviderModule } from "../module";

const huggingface: ProviderModule = {
  metadata: {
    name: "Hugging Face",
    iconSlug: "huggingface",
    iconFallback: "Box",
    brandColor: "#FFD21E",
    usageSectionLabels: { primary: "Inference", secondary: "ZeroGPU" },
    dashboardUrl: "https://huggingface.co/settings/billing",
    statusPageUrl: "https://status.huggingface.co",
  },
  aliases: ["hf"],
  mock: { source: "api" },
};

export default huggingface;
