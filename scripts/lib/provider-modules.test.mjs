import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkProviderModuleIndex,
  providerModuleIdsFromFiles,
  renderProviderIndex,
} from "./provider-modules.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("provider module index", () => {
  it("treats a child directory with index.ts as a provider", () => {
    expect(
      providerModuleIdsFromFiles({
        "src/providers/zoommate/index.ts": "",
        "src/providers/zoommate/extra.ts": "",
        "src/providers/catalog.ts": "",
        "src/providers/notes/readme.md": "",
      }),
    ).toEqual(["zoommate"]);
  });

  it("renders an empty module list", () => {
    expect(renderProviderIndex([])).toBe(
      `import type { ProviderModule } from "./module";\n\nexport const PROVIDER_MODULES = {} satisfies Record<string, ProviderModule>;\n`,
    );
  });

  it("rejects a directory name that cannot be a binding", () => {
    expect(() => renderProviderIndex(["not-a-binding"])).toThrow(/not a valid module binding/);
  });

  it("matches the committed index to the provider directories", async () => {
    await expect(checkProviderModuleIndex(root)).resolves.toEqual([]);
  });
});
