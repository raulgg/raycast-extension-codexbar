import { describe, expect, it } from "vitest";
import { normalizeProviderDetailPayload } from "../../usage/normalize";

function kiloPlan(loginMethod: string): string | undefined {
  return normalizeProviderDetailPayload(
    { provider: "kilo", usage: { loginMethod, primary: { usedPercent: 10 } } },
    "kilo",
  ).planText;
}

describe("kilo header text", () => {
  it("labels the pass slug and keeps an auto top-up notice out of the pass name", () => {
    expect(kiloPlan("tier_99 · Auto top-up: off")).toBe("Tier 99");
    expect(kiloPlan("starter · Auto top-up: off")).toBe("Starter");
    expect(kiloPlan("oauth · Auto top-up: off")).toBe("OAuth");
    expect(kiloPlan("api · Auto top-up: off")).toBe("API");
    expect(kiloPlan("openai · Auto top-up: off")).toBe("OpenAI");
    expect(kiloPlan("Kilo Pass Pro · Auto top-up: visa")).toBe("Kilo Pass Pro");
    expect(kiloPlan("Auto top-up: off")).toBe("Auto top-up: off");
    expect(kiloPlan("Auto top-up: off · extra")).toBe("Auto top-up: off · extra");
  });
});
