import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InstallHelpState, ResolvedCodexBarBinary } from "../cli/binary";
import { CodexBarCliError } from "../cli/exec";

const { readConfiguredProvidersMock, listAvailableProvidersMock, getCodexBarAvailabilityMock, isCodexBarMockModeMock } =
  vi.hoisted(() => ({
    readConfiguredProvidersMock: vi.fn(async () => []),
    listAvailableProvidersMock: vi.fn(async () => []),
    getCodexBarAvailabilityMock: vi.fn(),
    isCodexBarMockModeMock: vi.fn(() => false),
  }));

vi.mock("../config/providerConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../config/providerConfig")>()),
  readConfiguredProvidersFromConfig: readConfiguredProvidersMock,
  listAvailableProviders: listAvailableProvidersMock,
}));

vi.mock("../cli/binary", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../cli/binary")>()),
  getCodexBarAvailability: getCodexBarAvailabilityMock,
}));

vi.mock("../cli/mockPayloads", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../cli/mockPayloads")>()),
  isCodexBarMockMode: isCodexBarMockModeMock,
}));

import {
  createCodexBarClient,
  getCodexBarClientAvailability,
  hydrateCodexBarClientAvailability,
  loadCodexBarAvailabilitySnapshot,
} from "./codexbarClient";

const binary: ResolvedCodexBarBinary = {
  command: "/opt/homebrew/bin/codexbar",
  source: "fallback",
  keychainAccessPolicy: "disabled",
  capabilities: {
    appFetchProfile: true,
    interactionModes: true,
    presentationSchemaVersions: [1, 2],
    serveAppFetchProfile: false,
    serveForceRefresh: true,
  },
};

const appMissingInstall: InstallHelpState = {
  kind: "app-missing",
  title: "CodexBar CLI",
  markdown: "Install the CodexBar CLI",
  docsUrl: "https://example.com/docs",
  releasesUrl: "https://example.com/releases",
  repositoryUrl: "https://example.com/repo",
  homebrewCommands: {
    appAndCli: "brew install --cask example",
    cliOnly: "brew install --formula example",
  },
};

function restore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("CodexBar availability snapshot", () => {
  beforeEach(() => {
    readConfiguredProvidersMock.mockClear();
    listAvailableProvidersMock.mockClear();
    getCodexBarAvailabilityMock.mockReset();
    isCodexBarMockModeMock.mockReset();
    isCodexBarMockModeMock.mockReturnValue(false);
  });

  it("rebuilds client methods after the snapshot is restored from JSON", async () => {
    getCodexBarAvailabilityMock.mockResolvedValue({ status: "available", binary });

    const snapshot = await loadCodexBarAvailabilitySnapshot("disabled");
    const restored = restore(snapshot);
    const availability = hydrateCodexBarClientAvailability(restored);

    expect(getCodexBarAvailabilityMock).toHaveBeenCalledWith("disabled");
    expect(restored).toEqual(snapshot);
    expect(availability.status).toBe("available");
    if (availability.status !== "available") return;

    await availability.client.readConfiguredProviders();
    await availability.client.listAvailableProviders();

    expect(readConfiguredProvidersMock).toHaveBeenCalledTimes(1);
    expect(listAvailableProvidersMock).toHaveBeenCalledWith(binary);
    expect(availability.client.binary).toEqual(binary);
  });

  it("keeps the CLI error message that JSON would drop from an Error instance", async () => {
    const lostOnRestore = restore({ status: "error", error: new Error("codexbar --version failed") });
    expect(lostOnRestore.error).toEqual({});

    getCodexBarAvailabilityMock.mockResolvedValue({
      status: "error",
      error: new CodexBarCliError("execution", "codexbar --version failed"),
    });

    const snapshot = await loadCodexBarAvailabilitySnapshot("default");
    const availability = hydrateCodexBarClientAvailability(restore(snapshot));

    expect(restore(snapshot)).toEqual(snapshot);
    expect(availability).toMatchObject({
      status: "error",
      error: expect.objectContaining({ message: "codexbar --version failed" }),
    });
  });

  it("keeps install help and its error message across a cache restore", async () => {
    getCodexBarAvailabilityMock.mockResolvedValue({
      status: "unavailable",
      install: appMissingInstall,
      error: new CodexBarCliError("unavailable", "Unable to find the codexbar CLI"),
    });

    const snapshot = await loadCodexBarAvailabilitySnapshot("default");
    const availability = hydrateCodexBarClientAvailability(restore(snapshot));

    expect(availability).toMatchObject({
      status: "unavailable",
      install: appMissingInstall,
      error: expect.objectContaining({ message: "Unable to find the codexbar CLI" }),
    });
  });

  it("rebuilds the mock client from a restored mock snapshot", async () => {
    isCodexBarMockModeMock.mockReturnValue(true);

    const snapshot = await loadCodexBarAvailabilitySnapshot("disabled");
    const availability = hydrateCodexBarClientAvailability(restore(snapshot));

    expect(getCodexBarAvailabilityMock).not.toHaveBeenCalled();
    expect(availability.status).toBe("available");
    if (availability.status !== "available") return;

    expect(availability.client.binary).toMatchObject({ source: "mock", keychainAccessPolicy: "disabled" });
    expect(await availability.client.ensureServe()).toBe(false);
    expect(await availability.client.readConfiguredProviders()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "codex" })]),
    );
    expect(readConfiguredProvidersMock).not.toHaveBeenCalled();
  });

  it("rejects a JSON-restored CodexBarClient that has lost its methods", () => {
    const client = createCodexBarClient(binary);
    const poisoned = restore({ status: "available", client });

    expect(poisoned.client.readConfiguredProviders).toBeUndefined();
    expect(hydrateCodexBarClientAvailability(poisoned).status).toBe("error");
  });

  it("rejects a restored CLI snapshot whose binary cannot launch", () => {
    const availability = hydrateCodexBarClientAvailability({
      status: "available",
      mode: "cli",
      binary: { ...binary, command: "" },
    });

    expect(availability.status).toBe("error");
    if (availability.status === "error") {
      expect(availability.error).toBeInstanceOf(Error);
      expect(availability.error.message.length).toBeGreaterThan(0);
    }
  });

  it("returns a live client from getCodexBarClientAvailability", async () => {
    getCodexBarAvailabilityMock.mockResolvedValue({ status: "available", binary });

    const availability = await getCodexBarClientAvailability("disabled");

    expect(availability.status).toBe("available");
    if (availability.status !== "available") return;
    await expect(availability.client.readConfiguredProviders()).resolves.toEqual([]);
  });
});
