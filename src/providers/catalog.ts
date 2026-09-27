import { PROVIDER_MODULES } from "./index";
import { assertDistinctProviderModules, assembleProviderCatalog } from "./module";

export type ProviderUsageSectionLabels = {
  primary: string;
  secondary?: string;
  tertiary?: string;
};

export type ProviderIconFallback =
  | "AppWindow"
  | "ArrowRightCircle"
  | "BarChart"
  | "Bolt"
  | "Box"
  | "Bubble"
  | "Cloud"
  | "Code"
  | "Globe"
  | "Microphone"
  | "Network"
  | "Person"
  | "SpeakerOn"
  | "Stars"
  | "Terminal"
  | "TwoPeople";

export type ProviderCatalogEntry = {
  name: string;
  iconSlug: string;
  iconFallback?: ProviderIconFallback;
  brandColor: string;
  usageSectionLabels: ProviderUsageSectionLabels;
  dashboardUrl?: string;
  subscriptionDashboardUrl?: string;
  statusPageUrl?: string;
};

const LEGACY_PROVIDER_CATALOG = {
  codex: {
    name: "Codex",
    iconSlug: "codex",
    iconFallback: "Terminal",
    brandColor: "#49A3B0",
    usageSectionLabels: { primary: "Session", secondary: "Weekly" },
    dashboardUrl: "https://chatgpt.com/codex/settings/usage",
    statusPageUrl: "https://status.openai.com/",
  },
  claude: {
    name: "Claude",
    iconSlug: "claude",
    iconFallback: "Bubble",
    brandColor: "#CC7C5E",
    usageSectionLabels: { primary: "Session", secondary: "Weekly", tertiary: "Sonnet" },
    dashboardUrl: "https://console.anthropic.com/settings/billing",
    subscriptionDashboardUrl: "https://claude.ai/settings/usage",
    statusPageUrl: "https://status.claude.com/",
  },
} satisfies Record<string, ProviderCatalogEntry>;

const CATALOG_PROVIDER_ORDER = [
  "codex",
  "claude",
  "clinepass",
  "cursor",
  "opencode",
  "opencodego",
  "alibaba",
  "factory",
  "fireworks",
  "gemini",
  "antigravity",
  "copilot",
  "zai",
  "minimax",
  "kimi",
  "kilo",
  "kiro",
  "vertexai",
  "augment",
  "jetbrains",
  "amp",
  "ollama",
  "synthetic",
  "warp",
  "openrouter",
  "perplexity",
  "openai",
  "azureopenai",
  "alibabatokenplan",
  "qwencloud",
  "manus",
  "moonshot",
  "t3chat",
  "elevenlabs",
  "windsurf",
  "mimo",
  "doubao",
  "abacus",
  "mistral",
  "deepseek",
  "deepinfra",
  "codebuff",
  "venice",
  "commandcode",
  "stepfun",
  "bedrock",
  "grok",
  "groq",
  "llmproxy",
  "deepgram",
  "devin",
  "zed",
  "sakana",
  "qoder",
  "litellm",
  "poe",
  "chutes",
  "neuralwatt",
  "clawrouter",
  "wayfinder",
  "longcat",
  "sub2api",
  "zenmux",
  "aiand",
  "xai",
  "notion",
  "ibmbob",
  "atlascloud",
  "bifrost",
  "coderabbit",
  "devpass",
  "gitkraken",
  "helmcode",
  "huggingface",
  "hyper",
  "llmman",
  "muse",
  "nous",
  "pi",
  "replicate",
  "typesafe",
  "v0",
  "vercel",
  "zoommate",
] as const;

assertDistinctProviderModules(LEGACY_PROVIDER_CATALOG, PROVIDER_MODULES);

export const PROVIDER_CATALOG = assembleProviderCatalog(
  CATALOG_PROVIDER_ORDER,
  LEGACY_PROVIDER_CATALOG,
  PROVIDER_MODULES,
);

export const PROVIDER_ID_ALIASES: Record<string, string> = {};
