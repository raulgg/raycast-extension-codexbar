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
  cursor: {
    name: "Cursor",
    iconSlug: "cursor",
    iconFallback: "ArrowRightCircle",
    brandColor: "#00BFA5",
    usageSectionLabels: { primary: "Total", secondary: "Cursor", tertiary: "Third Party" },
    dashboardUrl: "https://cursor.com/dashboard?tab=usage",
    statusPageUrl: "https://status.cursor.com",
  },
  opencode: {
    name: "OpenCode",
    iconSlug: "opencode",
    iconFallback: "Code",
    brandColor: "#3B82F6",
    usageSectionLabels: { primary: "5-hour", secondary: "Weekly" },
    dashboardUrl: "https://opencode.ai/auth",
  },
  opencodego: {
    name: "OpenCode Go",
    iconSlug: "opencodego",
    iconFallback: "Code",
    brandColor: "#3B82F6",
    usageSectionLabels: { primary: "5-hour", secondary: "Weekly", tertiary: "Monthly" },
    dashboardUrl: "https://opencode.ai/auth",
  },
  alibaba: {
    name: "Alibaba",
    iconSlug: "alibaba",
    brandColor: "#FF6A00",
    usageSectionLabels: { primary: "5-hour", secondary: "Weekly", tertiary: "Monthly" },
    dashboardUrl: "https://modelstudio.console.alibabacloud.com/ap-southeast-1/?tab=coding-plan#/efm/coding_plan",
    statusPageUrl: "https://status.aliyun.com",
  },
  factory: {
    name: "Droid",
    iconSlug: "factory",
    brandColor: "#FF6B35",
    usageSectionLabels: { primary: "Standard", secondary: "Premium" },
    dashboardUrl: "https://app.factory.ai/settings/billing",
    statusPageUrl: "https://status.factory.ai",
  },
  gemini: {
    name: "Gemini",
    iconSlug: "gemini",
    iconFallback: "Bolt",
    brandColor: "#AB87EA",
    usageSectionLabels: { primary: "Pro", secondary: "Flash", tertiary: "Flash Lite" },
    dashboardUrl: "https://gemini.google.com",
    statusPageUrl: "https://www.google.com/appsstatus/dashboard/products/npdyhgECDJ6tB66MxXyo/history",
  },
  antigravity: {
    name: "Antigravity",
    iconSlug: "antigravity",
    brandColor: "#60BA7E",
    usageSectionLabels: { primary: "Gemini Models", secondary: "Claude and GPT" },
    statusPageUrl: "https://www.google.com/appsstatus/dashboard/products/npdyhgECDJ6tB66MxXyo/history",
  },
  copilot: {
    name: "Copilot",
    iconSlug: "copilot",
    iconFallback: "Person",
    brandColor: "#A855F7",
    usageSectionLabels: { primary: "Premium", secondary: "Chat" },
    dashboardUrl: "https://github.com/settings/copilot",
    statusPageUrl: "https://www.githubstatus.com/",
  },
  zai: {
    name: "z.ai / GLM",
    iconSlug: "zai",
    iconFallback: "Globe",
    brandColor: "#E85A6A",
    usageSectionLabels: { primary: "5-hour", secondary: "Weekly" },
    dashboardUrl: "https://z.ai/manage-apikey/coding-plan/personal/my-plan",
  },
  minimax: {
    name: "MiniMax",
    iconSlug: "minimax",
    brandColor: "#FE603C",
    usageSectionLabels: { primary: "Prompts", secondary: "Window" },
    dashboardUrl: "https://platform.minimax.io/user-center/payment/coding-plan?cycle_type=3",
  },
  kimi: {
    name: "Kimi Code",
    iconSlug: "kimi",
    brandColor: "#FE603C",
    usageSectionLabels: { primary: "7-day usage", secondary: "5-hour usage" },
    dashboardUrl: "https://www.kimi.com/code/console",
  },
  kilo: {
    name: "Kilo",
    iconSlug: "kilo",
    iconFallback: "BarChart",
    brandColor: "#F27027",
    usageSectionLabels: { primary: "Credits", secondary: "Kilo Pass" },
    dashboardUrl: "https://app.kilo.ai/usage",
  },
  kiro: {
    name: "Kiro",
    iconSlug: "kiro",
    brandColor: "#FF9900",
    usageSectionLabels: { primary: "Credits", secondary: "Bonus" },
    dashboardUrl: "https://app.kiro.dev/account/usage",
    statusPageUrl: "https://health.aws.amazon.com/health/status",
  },
  vertexai: {
    name: "Vertex AI",
    iconSlug: "vertexai",
    iconFallback: "Globe",
    brandColor: "#4285F4",
    usageSectionLabels: { primary: "Requests", secondary: "Tokens" },
    dashboardUrl: "https://console.cloud.google.com/vertex-ai",
    statusPageUrl: "https://status.cloud.google.com",
  },
  augment: {
    name: "Augment",
    iconSlug: "augment",
    iconFallback: "Bolt",
    brandColor: "#6366F1",
    usageSectionLabels: { primary: "Credits", secondary: "Usage" },
    dashboardUrl: "https://app.augmentcode.com/account/subscription",
    statusPageUrl: "https://status.augmentcode.com",
  },
  jetbrains: {
    name: "JetBrains AI",
    iconSlug: "jetbrains",
    iconFallback: "AppWindow",
    brandColor: "#FF3399",
    usageSectionLabels: { primary: "Current", secondary: "Refill" },
  },
  amp: {
    name: "Amp",
    iconSlug: "amp",
    iconFallback: "Bolt",
    brandColor: "#DC2626",
    usageSectionLabels: { primary: "Amp Free", secondary: "Balance" },
    dashboardUrl: "https://ampcode.com/settings/usage",
  },
  ollama: {
    name: "Ollama",
    iconSlug: "ollama",
    iconFallback: "Box",
    brandColor: "#888888",
    usageSectionLabels: { primary: "Session", secondary: "Weekly" },
    dashboardUrl: "https://ollama.com/settings",
  },
  synthetic: {
    name: "Synthetic",
    iconSlug: "synthetic",
    brandColor: "#141414",
    usageSectionLabels: { primary: "Five-hour quota", secondary: "Weekly tokens", tertiary: "Search hourly" },
  },
  warp: {
    name: "Warp",
    iconSlug: "warp",
    iconFallback: "ArrowRightCircle",
    brandColor: "#938BB4",
    usageSectionLabels: { primary: "Credits", secondary: "Add-on credits" },
    dashboardUrl: "https://docs.warp.dev/reference/cli/api-keys",
  },
  openrouter: {
    name: "OpenRouter",
    iconSlug: "openrouter",
    iconFallback: "TwoPeople",
    brandColor: "#6467F2",
    usageSectionLabels: { primary: "Credits", secondary: "Usage" },
    dashboardUrl: "https://openrouter.ai/activity",
    statusPageUrl: "https://status.openrouter.ai",
  },
  perplexity: {
    name: "Perplexity",
    iconSlug: "perplexity",
    iconFallback: "Globe",
    brandColor: "#20B2AA",
    usageSectionLabels: { primary: "Credits", secondary: "Bonus credits", tertiary: "Purchased" },
    dashboardUrl: "https://www.perplexity.ai/account/usage",
    statusPageUrl: "https://status.perplexity.com/",
  },
  grok: {
    name: "Grok",
    iconSlug: "grok",
    iconFallback: "Stars",
    brandColor: "#10A37F",
    usageSectionLabels: { primary: "Credits", secondary: "On-demand" },
    dashboardUrl: "https://grok.com/?_s=usage",
    statusPageUrl: "https://status.x.ai",
  },
  notion: {
    name: "Notion AI",
    iconSlug: "notion",
    iconFallback: "AppWindow",
    brandColor: "#337EA9",
    usageSectionLabels: { primary: "Rolling", secondary: "Monthly" },
    dashboardUrl: "https://app.notion.com/",
    statusPageUrl: "https://status.notion.so/",
  },
  helmcode: {
    name: "Helmcode",
    iconSlug: "helmcode",
    iconFallback: "Terminal",
    brandColor: "#4934E1",
    usageSectionLabels: { primary: "Model quota", secondary: "Model quota" },
    dashboardUrl: "https://cloud.helmcode.com/dashboard",
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

export const PROVIDER_ID_ALIASES: Record<string, string> = {
  "alibaba-coding-plan": "alibaba",
  bailian: "alibaba",
  "mini-max": "minimax",
  "kilo-ai": "kilo",
  "kimi-ai": "kimi",
  "kiro-cli": "kiro",
  "warp-ai": "warp",
  "warp-terminal": "warp",
  "synthetic.new": "synthetic",
  or: "openrouter",
  "z.ai": "zai",
  "notion-ai": "notion",
  notionai: "notion",
  "helm-code": "helmcode",
};
