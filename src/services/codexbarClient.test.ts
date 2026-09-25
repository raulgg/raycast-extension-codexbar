import { describe, expect, it, vi } from "vitest";

const { listAvailableProvidersMock, setProviderEnabledMock, fetchProviderDetailMock } = vi.hoisted(() => ({
  listAvailableProvidersMock: vi.fn(async () => []),
  setProviderEnabledMock: vi.fn(async () => undefined),
  fetchProviderDetailMock: vi.fn(async () => ({ id: "codex", name: "Codex", fetchedAt: "now", sections: [] })),
}));

vi.mock("../lib/providerConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/providerConfig")>()),
  listAvailableProviders: listAvailableProvidersMock,
  setProviderEnabled: setProviderEnabledMock,
}));

vi.mock("../cli/fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../cli/fetch")>()),
  fetchProviderDetail: fetchProviderDetailMock,
}));

import type { ResolvedCodexBarBinary } from "../cli/binary";
import { createCodexBarClient, createMockCodexBarClient } from "./codexbarClient";

const binary: ResolvedCodexBarBinary = {
  command: "/usr/local/bin/codexbar",
  source: "path",
  keychainAccessPolicy: "default",
};

describe("createCodexBarClient", () => {
  it("passes the resolved binary through to every CLI-backed operation", async () => {
    const client = createCodexBarClient(binary);

    await client.listAvailableProviders();
    await client.setProviderEnabled("groqcloud", true);
    await client.fetchProviderDetail("codex", { mode: "force", interaction: "user" });

    expect(client.binary).toBe(binary);
    expect(listAvailableProvidersMock).toHaveBeenCalledWith(binary);
    expect(setProviderEnabledMock).toHaveBeenCalledWith(binary, "groqcloud", true);
    expect(fetchProviderDetailMock).toHaveBeenCalledWith(binary, "codex", { mode: "force", interaction: "user" });
  });
});

describe("createMockCodexBarClient", () => {
  it("answers from fixtures under the requested Keychain policy and never touches serve or the config file", async () => {
    const client = createMockCodexBarClient("disabled");

    expect(client.binary).toMatchObject({ source: "mock", keychainAccessPolicy: "disabled" });
    expect(await client.ensureServe()).toBe(false);
    expect(await client.moveConfiguredProvider("codex", "down")).toBe(false);
    expect((await client.readConfiguredProviders()).length).toBeGreaterThan(0);
  });

  it("normalizes fixture payloads and carries the requested source and status", async () => {
    const client = createMockCodexBarClient("default");

    const detail = await client.fetchProviderDetail("codex", { source: "cli" });
    expect(detail).toMatchObject({ id: "codex", requestedSource: "cli" });
    expect(detail.sections.length).toBeGreaterThan(0);

    const withStatus = await client.fetchProviderUsageWithStatus("codex");
    expect(withStatus.detail.requestedSource).toBe("auto");
    expect(withStatus.status).toBeDefined();
  });
});
