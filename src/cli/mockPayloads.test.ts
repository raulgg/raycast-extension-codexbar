import { describe, expect, it } from "vitest";
import { getMockProviderPayload } from "./mockPayloads";

describe("getMockProviderPayload", () => {
  it("reads ZoomMate's mock source from the provider module", () => {
    expect(getMockProviderPayload("zoommate", new Date("2026-09-26T00:00:00Z")).source).toBe("web");
  });

  it("uses each provider's own sample", () => {
    const now = new Date("2026-09-26T00:00:00Z");

    expect(getMockProviderPayload("opencode", now)).toEqual({
      provider: "opencode",
      account: null,
      version: null,
      source: "web",
      status: null,
      usage: {
        primary: {
          usedPercent: 29,
          resetsAt: "2026-09-26T02:00:00.000Z",
          resetDescription: null,
        },
        secondary: {
          usedPercent: 56,
          resetsAt: "2026-09-27T00:00:00.000Z",
          resetDescription: null,
        },
        tertiary: null,
        updatedAt: "2026-09-26T00:00:00.000Z",
      },
      credits: null,
      antigravityPlanInfo: null,
      openaiDashboard: null,
      error: null,
    });
    expect(getMockProviderPayload("gemini", now)).toMatchObject({
      source: "api",
      version: "0.12.0",
      usage: {
        primary: { usedPercent: 51, resetDescription: "Free tier" },
        secondary: { resetDescription: "Pro quota" },
        tertiary: { resetDescription: "Monthly cap" },
        loginMethod: "Google AI Pro",
      },
    });
    expect(getMockProviderPayload("minimax", now)).toMatchObject({
      source: "web",
      usage: { primary: { resetDescription: "1000 prompts / 5 hours" }, secondary: null },
    });
    expect(getMockProviderPayload("kiro", now)).toMatchObject({
      source: "cli",
      version: "0.4.0",
      usage: {
        primary: { usedPercent: 38, resetsAt: "2026-10-26T00:00:00.000Z" },
        secondary: { resetDescription: "expires in 14d" },
        loginMethod: "Kiro Pro",
      },
    });
    expect(getMockProviderPayload("vertexai", now)).toMatchObject({
      source: "oauth",
      usage: { primary: null, secondary: null, tertiary: null, loginMethod: "gcloud" },
    });
    expect(getMockProviderPayload("augment", now)).toMatchObject({
      source: "web",
      usage: { primary: { resetDescription: "Resets in 3d" }, accountEmail: "dev@example.com" },
    });
    expect(getMockProviderPayload("jetbrains", now)).toMatchObject({
      source: "local",
      usage: { primary: { resetDescription: "Resets in 7d" }, loginMethod: "AI Pro" },
    });
    expect(getMockProviderPayload("synthetic", now)).toMatchObject({
      source: "api",
      usage: { secondary: { usedPercent: 70, resetDescription: "60 minutes" } },
    });
    expect(getMockProviderPayload("warp", now)).toMatchObject({
      source: "api",
      usage: { primary: { usedPercent: 0, resetDescription: "Unlimited" }, loginMethod: null },
    });
    expect(getMockProviderPayload("perplexity", now)).toMatchObject({
      source: "api",
      usage: {
        primary: { resetDescription: "54/100 credits" },
        secondary: { resetDescription: "20 promo credits" },
        tertiary: { resetDescription: "8 purchased credits" },
      },
    });
  });
});
