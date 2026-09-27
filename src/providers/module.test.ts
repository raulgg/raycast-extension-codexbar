import { describe, expect, it } from "vitest";
import { PROVIDER_CATALOG, type ProviderCatalogEntry } from "./catalog";
import { assertDistinctProviderModules, providerModuleMetadata, type ProviderModule } from "./module";

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

  it("rejects a module id that is still in the legacy catalog", () => {
    const legacy: Record<string, ProviderCatalogEntry> = { sample: sample.metadata };
    expect(() => assertDistinctProviderModules(legacy, { sample })).toThrow(/duplicate legacy catalog ids: sample/);
  });

  it("keeps ZoomMate in a closed catalog id set", () => {
    const hasZoomMate: "zoommate" extends keyof typeof PROVIDER_CATALOG ? true : never = true;
    const closed: string extends keyof typeof PROVIDER_CATALOG ? false : true = true;
    expect(hasZoomMate && closed && PROVIDER_CATALOG.zoommate.name).toBe("ZoomMate");
  });
});
