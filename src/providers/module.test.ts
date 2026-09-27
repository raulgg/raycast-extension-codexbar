import { describe, expect, it } from "vitest";
import { PROVIDER_CATALOG, PROVIDER_ID_ALIASES } from "./index";
import { assembleProviderCatalog, providerIdAliases, providerModuleMetadata, type ProviderModule } from "./module";

const sample = {
  metadata: {
    name: "Sample",
    iconSlug: "sample",
    brandColor: "#000000",
    usageSectionLabels: { primary: "Primary" },
  },
} satisfies ProviderModule;

describe("provider modules", () => {
  it("keys module metadata by provider id", () => {
    expect(providerModuleMetadata({ sample })).toEqual({ sample: sample.metadata });
  });

  it("keeps ZoomMate in a closed catalog id set", () => {
    const hasZoomMate: "zoommate" extends keyof typeof PROVIDER_CATALOG ? true : never = true;
    const closed: string extends keyof typeof PROVIDER_CATALOG ? false : true = true;
    expect(hasZoomMate && closed && PROVIDER_CATALOG.zoommate.name).toBe("ZoomMate");
  });

  it("requires every ordered id to come from a module", () => {
    expect(() => assembleProviderCatalog(["missing"], {})).toThrow(/Missing provider module for missing/);
    expect(() => assembleProviderCatalog(["sample", "sample"], { sample })).toThrow(
      /Duplicate catalog order id: sample/,
    );
    expect(() => assembleProviderCatalog([], { sample })).toThrow(/Provider module id missing from order: sample/);
  });

  it("derives the alias map from modules", () => {
    expect(PROVIDER_ID_ALIASES["alibaba-coding-plan"]).toBe("alibaba");
    expect(PROVIDER_ID_ALIASES.codex).toBeUndefined();
    expect(() =>
      providerIdAliases({
        one: { ...sample, aliases: ["shared"] },
        two: { ...sample, aliases: ["shared"] },
      }),
    ).toThrow(/Alias "shared" is shared by one and two/);
    expect(() => providerIdAliases({ one: { ...sample, aliases: ["one"] } })).toThrow(/Alias "one" is a provider id/);
  });
});
