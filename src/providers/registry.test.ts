import { existsSync } from "node:fs";
import path from "node:path";
import { Color, Icon } from "@raycast/api";
import { describe, expect, it } from "vitest";
import { PROVIDER_CATALOG } from "./index";
import type { ProviderCatalogEntry } from "./types";
import type { ProviderModule } from "./module";
import {
  getProviderMetadata,
  getProviderProgressPalette,
  getProviderUsageSectionDisplayTitle,
  isKnownProviderId,
  PROVIDER_IDS,
  PROVIDER_SELECTOR_IDS,
  resolveDashboardUrl,
  resolveProviderId,
} from "./registry";

describe("provider registry", () => {
  it("covers the documented provider IDs without including selector aliases", () => {
    expect(PROVIDER_IDS.slice(0, 5)).toEqual(["codex", "claude", "clinepass", "cursor", "opencode"]);
    expect(PROVIDER_IDS).toContain("codex");
    expect(PROVIDER_IDS).toContain("claude");
    expect(PROVIDER_IDS).toContain("opencodego");
    expect(PROVIDER_IDS).toContain("alibaba");
    expect(PROVIDER_IDS).toContain("openrouter");
    expect(PROVIDER_IDS).toContain("perplexity");
    expect(PROVIDER_IDS).not.toContain("all");
    expect(PROVIDER_IDS).not.toContain("both");
    expect(PROVIDER_SELECTOR_IDS).toEqual(["all", "both"]);
  });

  it("recognizes known providers", () => {
    expect(isKnownProviderId("codex")).toBe(true);
    expect(isKnownProviderId("unknown-provider")).toBe(false);
  });

  it("resolves upstream CLI aliases to canonical provider ids", () => {
    expect(resolveProviderId("alibaba-coding-plan")).toBe("alibaba");
    expect(resolveProviderId("alibaba-token-plan")).toBe("alibabatokenplan");
    expect(resolveProviderId("azure-openai")).toBe("azureopenai");
    expect(resolveProviderId("abacusai")).toBe("abacus");
    expect(resolveProviderId("groqcloud")).toBe("groq");
    expect(resolveProviderId("codex")).toBe("codex");
    expect(resolveProviderId("unknown-provider")).toBe("unknown-provider");
    expect(
      resolveProviderId("fw", {
        other: {
          metadata: {
            name: "Other",
            iconSlug: "other",
            brandColor: "#000000",
            usageSectionLabels: { primary: "Primary" },
          },
          aliases: ["fw"],
        },
      }),
    ).toBe("other");

    expect(isKnownProviderId("alibaba-coding-plan")).toBe(true);
    expect(getProviderMetadata("alibaba-coding-plan").id).toBe("alibaba");
    expect(getProviderMetadata("groqcloud").name).toBe("Groq");

    expect(resolveProviderId("sakana-ai")).toBe("sakana");
    expect(resolveProviderId("litellm-proxy")).toBe("litellm");
    expect(resolveProviderId("chutes.ai")).toBe("chutes");
    expect(resolveProviderId("claw-router")).toBe("clawrouter");
    expect(resolveProviderId("wayfinder-router")).toBe("wayfinder");
    expect(resolveProviderId("qwen-cloud")).toBe("qwencloud");
    expect(resolveProviderId("fw")).toBe("fireworks");
    expect(resolveProviderId("ai&")).toBe("aiand");
    expect(resolveProviderId("bob")).toBe("ibmbob");
    expect(resolveProviderId("sub-2-api")).toBe("sub2api");
    expect(resolveProviderId("kiro-cli")).toBe("kiro");
    expect(resolveProviderId("mini-max")).toBe("minimax");
    expect(resolveProviderId("warp-ai")).toBe("warp");
    expect(resolveProviderId("warp-terminal")).toBe("warp");
    expect(resolveProviderId("synthetic.new")).toBe("synthetic");
    expect(resolveProviderId("hf")).toBe("huggingface");
    expect(resolveProviderId("gk")).toBe("gitkraken");
    expect(resolveProviderId("muse-code")).toBe("muse");
    expect(resolveProviderId("hermes")).toBe("nous");
    expect(resolveProviderId("r8")).toBe("replicate");
    expect(resolveProviderId("helm-code")).toBe("helmcode");
    expect(resolveProviderId("or")).toBe("openrouter");
    expect(resolveProviderId("notion-ai")).toBe("notion");
    expect(resolveProviderId("notionai")).toBe("notion");
    expect(resolveProviderId("z.ai")).toBe("zai");
  });

  it("uses harvested upstream metadata for new providers", () => {
    expect(getProviderMetadata("openai")).toMatchObject({
      name: "OpenAI",
      brandColor: "#0F826E",
      usageSectionLabels: { primary: "Spend", secondary: "Requests" },
    });
    expect(getProviderMetadata("mistral")).toMatchObject({
      name: "Mistral",
      brandColor: "#FF500F",
      usageSectionLabels: { primary: "Balance" },
    });
    expect(getProviderMetadata("alibabatokenplan")).toMatchObject({
      name: "Alibaba Token Plan",
      brandColor: "#FF6A00",
      usageSectionLabels: { primary: "Credits", secondary: "Usage" },
    });
    expect(getProviderMetadata("huggingface")).toMatchObject({
      name: "Hugging Face",
      brandColor: "#FFD21E",
      usageSectionLabels: { primary: "Inference", secondary: "ZeroGPU" },
      dashboardUrl: "https://huggingface.co/settings/billing",
      statusPageUrl: "https://status.huggingface.co",
    });
    expect(getProviderMetadata("llmman")).toMatchObject({
      name: "llmman",
      brandColor: "#6CC5B0",
      dashboardUrl: "http://127.0.0.1:17434",
    });
    expect(getProviderMetadata("devin")).toMatchObject({
      name: "Devin",
      brandColor: "#46B482",
      usageSectionLabels: { primary: "Daily", secondary: "Weekly" },
    });
    expect(getProviderMetadata("zed")).toMatchObject({
      name: "Zed",
      brandColor: "#084EFF",
      usageSectionLabels: { primary: "Edit predictions", secondary: "Billing cycle" },
    });
    expect(getProviderMetadata("sakana")).toMatchObject({
      name: "Sakana AI",
      brandColor: "#2975DB",
      usageSectionLabels: { primary: "5-hour", secondary: "Weekly" },
    });
    expect(getProviderMetadata("qoder")).toMatchObject({
      name: "Qoder",
      brandColor: "#10B981",
      usageSectionLabels: { primary: "Credits", secondary: "Balance" },
    });
    expect(getProviderMetadata("litellm")).toMatchObject({
      name: "LiteLLM",
      brandColor: "#4C89F0",
      usageSectionLabels: { primary: "Personal budget", secondary: "Team budget" },
    });
    expect(getProviderMetadata("poe")).toMatchObject({
      name: "Poe",
      brandColor: "#5D5CDE",
      usageSectionLabels: { primary: "Points", secondary: "Points" },
    });
    expect(getProviderMetadata("chutes")).toMatchObject({
      name: "Chutes",
      brandColor: "#3184FF",
      usageSectionLabels: { primary: "4-hour quota", secondary: "Monthly quota" },
    });
    expect(getProviderMetadata("clinepass")).toMatchObject({
      name: "ClinePass",
      brandColor: "#61A3FA",
      usageSectionLabels: { primary: "5-hour", secondary: "Weekly", tertiary: "Monthly" },
    });
    expect(getProviderMetadata("qwencloud")).toMatchObject({
      name: "Qwen Cloud",
      brandColor: "#615CED",
      usageSectionLabels: { primary: "5-hour", secondary: "Weekly" },
    });
    expect(getProviderMetadata("sub2api")).toMatchObject({
      name: "sub2api",
      brandColor: "#2DC6D8",
      usageSectionLabels: { primary: "Quota", secondary: "Weekly quota", tertiary: "Monthly quota" },
    });
    expect(getProviderMetadata("clawrouter")).toMatchObject({
      name: "ClawRouter",
      brandColor: "#596EF6",
      usageSectionLabels: { primary: "Monthly budget", secondary: "Requests" },
    });
    expect(getProviderMetadata("wayfinder")).toMatchObject({
      name: "Wayfinder",
      brandColor: "#10A37F",
      usageSectionLabels: { primary: "Savings", secondary: "Requests" },
      dashboardUrl: "http://127.0.0.1:8088/router",
    });
    expect(getProviderMetadata("aixy")).toMatchObject({
      name: "Aixy",
      brandColor: "#123650",
      usageSectionLabels: { primary: "Budget", secondary: "Secondary budget" },
      dashboardUrl: "https://dash.aixy-gateway.com",
    });
    expect(getProviderMetadata("raycast")).toMatchObject({
      name: "Raycast",
      brandColor: "#FF6363",
      usageSectionLabels: { primary: "Credits", secondary: "Plan" },
      dashboardUrl: "https://www.raycast.com/settings",
    });
    expect(getProviderMetadata("xkiro")).toMatchObject({
      name: "xKiro",
      brandColor: "#52C99B",
      usageSectionLabels: { primary: "Daily free tokens", secondary: "Weekly" },
      dashboardUrl: "https://xkiro.com",
    });
  });

  it("harvests upstream dashboard URLs for providers that have one", () => {
    expect(getProviderMetadata("codex").dashboardUrl).toBe("https://chatgpt.com/codex/cloud/settings/analytics#usage");
    expect(getProviderMetadata("claude").dashboardUrl).toBe("https://console.anthropic.com/settings/billing");
    expect(getProviderMetadata("cursor").dashboardUrl).toBe("https://cursor.com/dashboard?tab=usage");
    expect(getProviderMetadata("qwencloud").dashboardUrl).toBe(
      "https://home.qwencloud.com/billing/subscription/token-plan-individual",
    );
  });

  it("omits dashboardUrl for providers where upstream has no dashboard", () => {
    expect(getProviderMetadata("zed").dashboardUrl).toBeUndefined();
    expect(getProviderMetadata("jetbrains").dashboardUrl).toBeUndefined();
    expect(getProviderMetadata("synthetic").dashboardUrl).toBeUndefined();
  });

  it("harvests upstream status page URLs for providers that have one", () => {
    expect(getProviderMetadata("claude").statusPageUrl).toBe("https://status.claude.com/");
    expect(getProviderMetadata("cursor").statusPageUrl).toBe("https://status.cursor.com");
    expect(getProviderMetadata("copilot").statusPageUrl).toBe("https://www.githubstatus.com/");
    expect(getProviderMetadata("codex").statusPageUrl).toBe("https://status.openai.com/");
    expect(getProviderMetadata("augment").statusPageUrl).toBe("https://status.augmentcode.com");
    expect(getProviderMetadata("factory").statusPageUrl).toBe("https://status.factory.ai");
    expect(getProviderMetadata("openai").statusPageUrl).toBe("https://status.openai.com");
  });

  it("omits statusPageUrl for providers where upstream has no status page", () => {
    expect(getProviderMetadata("zed").statusPageUrl).toBeUndefined();
    expect(getProviderMetadata("jetbrains").statusPageUrl).toBeUndefined();
    expect(getProviderMetadata("synthetic").statusPageUrl).toBeUndefined();
  });

  it("falls back to the semantic slot title when a label is missing", () => {
    expect(getProviderUsageSectionDisplayTitle("mistral", "Primary")).toBe("Balance");
    expect(getProviderUsageSectionDisplayTitle("mistral", "Secondary")).toBe("Secondary");
  });

  it("passes catalog iconFallback through instead of substituting Circle", () => {
    for (const id of PROVIDER_IDS) {
      const fallback = (PROVIDER_CATALOG[id] as ProviderCatalogEntry).iconFallback;
      if (!fallback) {
        continue;
      }

      expect(getProviderMetadata(id).icon).toMatchObject({ fallback });
    }
  });

  it("paints a valid accent over the catalog color and ignores anything else", () => {
    expect(getProviderProgressPalette("grok", "#000000")).toEqual({
      lightFill: "#000000",
      darkFill: "#000000",
    });
    expect(getProviderProgressPalette("grok", "  #000000 ")).toEqual({
      lightFill: "#000000",
      darkFill: "#000000",
    });
    expect(getProviderProgressPalette("grok", "#fff")).toEqual({
      lightFill: "#10A37F",
      darkFill: "#10A37F",
    });
    expect(getProviderProgressPalette("grok", "not a color")).toEqual({
      lightFill: "#10A37F",
      darkFill: "#10A37F",
    });
  });

  it("returns friendly metadata for known providers", () => {
    expect(getProviderMetadata("openrouter")).toEqual({
      id: "openrouter",
      name: "OpenRouter",
      icon: {
        source: "provider-icons/openrouter.svg",
        fallback: Icon.TwoPeople,
        tintColor: Color.PrimaryText,
      },
      brandColor: "#6467F2",
      progressPalette: {
        lightFill: "#6467F2",
        darkFill: "#6467F2",
      },
      usageSectionLabels: { primary: "Credits", secondary: "Usage" },
      dashboardUrl: "https://openrouter.ai/activity",
      statusPageUrl: "https://status.openrouter.ai",
    });
  });

  it("uses upstream svg assets when present", () => {
    expect(getProviderMetadata("alibaba")).toEqual({
      id: "alibaba",
      name: "Alibaba",
      icon: {
        source: "provider-icons/alibaba.svg",
        fallback: Icon.Circle,
        tintColor: Color.PrimaryText,
      },
      brandColor: "#FF6A00",
      progressPalette: {
        lightFill: "#FF6A00",
        darkFill: "#FF6A00",
      },
      usageSectionLabels: { primary: "5-hour", secondary: "Weekly", tertiary: "Monthly" },
      dashboardUrl: "https://modelstudio.console.alibabacloud.com/ap-southeast-1/?tab=coding-plan#/efm/coding_plan",
      statusPageUrl: "https://status.aliyun.com",
    });
  });

  it("includes OpenCode Go with its upstream provider id", () => {
    expect(getProviderMetadata("opencodego")).toEqual({
      id: "opencodego",
      name: "OpenCode Go",
      icon: {
        source: "provider-icons/opencodego.svg",
        fallback: Icon.Code,
        tintColor: Color.PrimaryText,
      },
      brandColor: "#3B82F6",
      progressPalette: {
        lightFill: "#3B82F6",
        darkFill: "#3B82F6",
      },
      usageSectionLabels: { primary: "5-hour", secondary: "Weekly", tertiary: "Monthly" },
      dashboardUrl: "https://opencode.ai/auth",
    });
  });

  it("has a local svg asset for every catalog iconSlug", () => {
    const providerIconSlugs = Object.values(PROVIDER_CATALOG).map((entry) => entry.iconSlug);

    expect(providerIconSlugs.length).toBeGreaterThan(0);

    for (const slug of providerIconSlugs) {
      expect(existsSync(path.join(process.cwd(), "assets/provider-icons", `${slug}.svg`))).toBe(true);
    }
  });

  it("paints catalog brand colors unchanged in both appearances", () => {
    expect(getProviderMetadata("vercel").progressPalette).toEqual({
      lightFill: "#FFFFFF",
      darkFill: "#FFFFFF",
    });
    expect(getProviderMetadata("replicate").progressPalette).toEqual({
      lightFill: "#000000",
      darkFill: "#000000",
    });
  });

  it("falls back to a title-cased label for unknown providers", () => {
    expect(getProviderMetadata("my-provider_name")).toEqual({
      id: "my-provider_name",
      name: "My Provider Name",
      icon: Icon.Circle,
      brandColor: "#22B8CF",
      progressPalette: {
        lightFill: "#22B8CF",
        darkFill: "#22B8CF",
      },
      usageSectionLabels: { primary: "Primary", secondary: "Secondary", tertiary: "Tertiary" },
    });
  });

  it("harvests upstream subscription dashboard URLs for providers that have one", () => {
    expect(getProviderMetadata("claude").subscriptionDashboardUrl).toBe("https://claude.ai/settings/usage");
    expect(getProviderMetadata("devin").subscriptionDashboardUrl).toBe("https://app.devin.ai/settings/usage");
    expect(getProviderMetadata("t3chat").subscriptionDashboardUrl).toBe("https://t3.chat/settings/subscription");
    expect(getProviderMetadata("elevenlabs").subscriptionDashboardUrl).toBe("https://elevenlabs.io/app/subscription");
    expect(getProviderMetadata("commandcode").subscriptionDashboardUrl).toBe("https://commandcode.ai/settings/billing");
    expect(getProviderMetadata("neuralwatt").subscriptionDashboardUrl).toBe("https://portal.neuralwatt.com/dashboard");
    expect(getProviderMetadata("ibmbob").subscriptionDashboardUrl).toBe("https://bob.ibm.com");
  });

  it("omits subscriptionDashboardUrl for providers without one", () => {
    expect(getProviderMetadata("codex").subscriptionDashboardUrl).toBeUndefined();
    expect(getProviderMetadata("cursor").subscriptionDashboardUrl).toBeUndefined();
  });

  describe("resolveDashboardUrl", () => {
    const subscription = "https://claude.ai/settings/usage";
    const consoleUrl = "https://console.anthropic.com/settings/billing";

    it("opens the Claude subscription page for Max, Pro, Team, and Ultra", () => {
      for (const plan of [
        "max",
        "pro",
        "team",
        "ultra",
        "Claude Max",
        "CLAUDE PRO",
        "Claude Team",
        "claude ultra",
        "ClaudeMax",
        "claudepro",
        "claudeTeam",
        "ClaudeUltra",
        "defaultclaudemax20x",
        "max20x",
        "Ultra",
      ]) {
        expect(resolveDashboardUrl("claude", plan)).toBe(subscription);
      }
    });

    it("opens the Claude console for Enterprise and everyone else", () => {
      for (const plan of [
        "enterprise",
        "Claude Enterprise",
        "ClaudeEnterprise",
        "api-key",
        "oauth",
        "API Key",
        "profile",
        "",
        undefined,
      ]) {
        expect(resolveDashboardUrl("claude", plan)).toBe(consoleUrl);
      }
    });

    it("prefers the subscription dashboard for other dual-URL providers regardless of plan", () => {
      expect(resolveDashboardUrl("devin", undefined)).toBe("https://app.devin.ai/settings/usage");
      expect(resolveDashboardUrl("t3chat", "pro")).toBe("https://t3.chat/settings/subscription");
      expect(resolveDashboardUrl("elevenlabs", undefined)).toBe("https://elevenlabs.io/app/subscription");
      expect(resolveDashboardUrl("commandcode", undefined)).toBe("https://commandcode.ai/settings/billing");
    });

    it("keeps the plain dashboard for providers without a subscription dashboard", () => {
      expect(resolveDashboardUrl("cursor", "pro")).toBe("https://cursor.com/dashboard?tab=usage");
    });

    it("sends Helmcode NaN Builders accounts to nan.builders and everyone else to helmcode.com", () => {
      expect(resolveDashboardUrl("helmcode", undefined, "NaN Builders")).toBe("https://cloud.nan.builders/dashboard");
      expect(resolveDashboardUrl("helmcode", undefined, "Helmcode")).toBe("https://cloud.helmcode.com/dashboard");
      expect(resolveDashboardUrl("helmcode")).toBe("https://cloud.helmcode.com/dashboard");
    });

    it("uses a provider module dashboard when the module defines one", () => {
      const fixture: ProviderModule = {
        metadata: {
          name: "Fixture",
          iconSlug: "fixture",
          brandColor: "#112233",
          usageSectionLabels: { primary: "Primary" },
        },
        dashboardUrl: ({ planText, accountOrganization }) =>
          `https://fixture.example/${planText}/${accountOrganization}`,
      };

      expect(resolveDashboardUrl("fixture", "Pro", "Acme", { fixture })).toBe("https://fixture.example/Pro/Acme");
    });
  });

  it("returns upstream usage section labels for semantic slots", () => {
    expect(getProviderUsageSectionDisplayTitle("cursor", "Primary")).toBe("Total");
    expect(getProviderUsageSectionDisplayTitle("cursor", "Secondary")).toBe("Cursor");
    expect(getProviderUsageSectionDisplayTitle("cursor", "Tertiary")).toBe("Third Party");
    expect(getProviderUsageSectionDisplayTitle("amp", "Tertiary")).toBe("Tertiary");
    expect(getProviderUsageSectionDisplayTitle("codex", "Credits")).toBe("Credits");
  });
});
