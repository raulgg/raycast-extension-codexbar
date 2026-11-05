import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderMeterDetail } from "./lib/meter-detail.mjs";
import { syncMeterDetail } from "./sync-meter-detail.mjs";

const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function descriptor(id, card) {
  return `
public enum ${id}ProviderDescriptor {
    static func makeDescriptor() -> ProviderDescriptor {
        ProviderDescriptor(
            id: .${id},
            metadata: ProviderMetadata(
                id: .${id},
                displayName: "${id}",
                sessionLabel: "Session",
                weeklyLabel: "Weekly",
                opusLabel: nil,
                toggleTitle: "Show usage",
                cliName: "${id}",
                dashboardURL: nil,
                statusPageURL: nil,
                statusLinkURL: nil),
            branding: ProviderBranding(
                iconStyle: .monochrome,
                color: ProviderColor(red: 0, green: 0, blue: 0)),
            presentation: ProviderUsagePresentation(menuCard: ${card}))
    }
}
`;
}

function source(files) {
  return {
    label: "fixture tree",
    listFiles: async (prefix, suffix) =>
      Object.keys(files).filter((file) => file.startsWith(prefix) && file.endsWith(suffix)),
    readFile: async (file) => files[file],
  };
}

async function tempRoot(contents) {
  const root = await mkdtemp(path.join(os.tmpdir(), "sync-meter-detail-"));
  roots.push(root);
  const file = path.join(root, "src/providers/meterDetail.ts");
  await mkdir(path.dirname(file), { recursive: true });
  if (contents !== undefined) await writeFile(file, contents);
  return { root, file };
}

describe("syncMeterDetail", () => {
  it("writes meterDetail.ts from the descriptors with the new flags", async () => {
    const { root, file } = await tempRoot("stale\n");
    const files = {
      "Sources/CodexBarCore/Providers/DeepSeek/DeepSeekProviderDescriptor.swift": descriptor(
        "deepseek",
        "ProviderMenuCardPresentation(showsPrimaryBalanceDescription: true, movePrimaryDetailToStatus: { _ in true })",
      ),
      "Sources/CodexBarCore/Providers/Sub2API/Sub2APIProviderDescriptor.swift": descriptor(
        "sub2api",
        "ProviderMenuCardPresentation(usesRawPrimaryResetDescription: true)",
      ),
      "Sources/CodexBarCore/Providers/ProviderDescriptor.swift": "public struct ProviderDescriptor {}",
    };
    await expect(syncMeterDetail(source(files), root)).resolves.toEqual({ written: true, problems: [] });
    const written = await readFile(file, "utf8");
    expect(written).toBe(
      renderMeterDetail({
        deepseek: { showsPrimaryBalanceDescription: true, movePrimaryDetailToStatus: true },
        sub2api: {
          usesRawPrimaryResetDescription: true,
          secondaryRawResetDescription: true,
          tertiaryRawResetDescription: true,
        },
      }),
    );
    expect(written).toContain("movePrimaryDetailToStatus: true");
    expect(written).toContain("usesRawPrimaryResetDescription: true");
    await expect(syncMeterDetail(source(files), root)).resolves.toEqual({ written: false, problems: [] });
  });

  it("writes nothing when a descriptor does not parse", async () => {
    const { root, file } = await tempRoot("kept\n");
    const files = {
      "Sources/CodexBarCore/Providers/Toy/ToyProviderDescriptor.swift": descriptor(
        "toy",
        "ProviderMenuCardPresentation(showsPrimaryBalanceDescription: maybe)",
      ),
    };
    const result = await syncMeterDetail(source(files), root);
    expect(result.written).toBe(false);
    expect(result.problems.join("\n")).toMatch(/not a boolean literal/);
    expect(await readFile(file, "utf8")).toBe("kept\n");
  });
});
