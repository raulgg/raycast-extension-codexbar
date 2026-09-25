import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFileMock, writeFileMock, execFileMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  writeFileMock: vi.fn(),
  execFileMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
  writeFile: writeFileMock,
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import type { ResolvedCodexBarBinary } from "../cli/binary";
import {
  listAvailableProviders,
  normalizeAvailableProviders,
  orderEnabledProvidersByConfig,
  setProviderEnabled,
} from "./providerConfig";

function mockExecSuccess(stdout = "CodexBar", stderr = "") {
  execFileMock.mockImplementation(
    (
      _command: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => {
      callback(null, stdout, stderr);
    },
  );
}

describe("available providers", () => {
  const binary: ResolvedCodexBarBinary = { command: "codexbar", source: "path", keychainAccessPolicy: "default" };

  beforeEach(() => {
    execFileMock.mockReset();
    readFileMock.mockReset();
  });

  it("normalizes `config providers` output, joining the registry and resolving aliases", () => {
    const providers = normalizeAvailableProviders([
      { provider: "claude", displayName: "Claude", enabled: true },
      { provider: "codex", displayName: "Codex", enabled: false },
      { provider: "groqcloud", displayName: "Groq", enabled: false },
    ]);

    expect(providers).toEqual([
      expect.objectContaining({ id: "claude", cliProvider: "claude", name: "Claude", enabled: true }),
      expect.objectContaining({ id: "codex", cliProvider: "codex", enabled: false }),
      // `groqcloud` resolves to the canonical `groq` registry id for display.
      expect.objectContaining({ id: "groq", cliProvider: "groqcloud", name: "Groq", enabled: false }),
    ]);
  });

  it("falls back to the CLI displayName for providers the registry does not know", () => {
    const providers = normalizeAvailableProviders([
      { provider: "someunknownprovider", displayName: "Some New Provider", enabled: false },
    ]);

    expect(providers[0].name).toBe("Some New Provider");
  });

  it("skips selector ids, malformed entries, and alias duplicates", () => {
    const providers = normalizeAvailableProviders([
      { provider: "all", enabled: true },
      { provider: "  ", enabled: true },
      null,
      { provider: "groq", enabled: true },
      { provider: "groqcloud", enabled: false },
    ]);

    expect(providers.map((provider) => provider.id)).toEqual(["groq"]);
  });

  it("lists available providers from the CLI", async () => {
    mockExecSuccess(JSON.stringify([{ provider: "codex", displayName: "Codex", enabled: true }]));

    const providers = await listAvailableProviders(binary);

    expect(providers).toEqual([expect.objectContaining({ id: "codex", cliProvider: "codex", enabled: true })]);
    expect(execFileMock).toHaveBeenCalledWith(
      "codexbar",
      ["config", "providers", "--format", "json", "--json-only"],
      expect.anything(),
      expect.any(Function),
    );
  });

  it("enables and disables a provider through the CLI", async () => {
    mockExecSuccess(JSON.stringify({ provider: "grok", enabled: true }));
    await setProviderEnabled(binary, "grok", true);
    expect(execFileMock).toHaveBeenLastCalledWith(
      "codexbar",
      ["config", "enable", "--provider", "grok", "--format", "json", "--json-only"],
      expect.anything(),
      expect.any(Function),
    );

    mockExecSuccess(JSON.stringify({ provider: "grok", enabled: false }));
    await setProviderEnabled(binary, "grok", false);
    expect(execFileMock).toHaveBeenLastCalledWith(
      "codexbar",
      ["config", "disable", "--provider", "grok", "--format", "json", "--json-only"],
      expect.anything(),
      expect.any(Function),
    );
  });

  it("throws when `config providers` output is not an array", () => {
    let thrownError: unknown;
    try {
      normalizeAvailableProviders({ providers: [] });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toMatchObject({ kind: "invalid-json" });
  });

  it("refuses to toggle a provider without an id and never spawns the CLI", async () => {
    await expect(setProviderEnabled(binary, "  ", true)).rejects.toMatchObject({ kind: "execution" });
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("marks providers the registry does not know as unsupported", () => {
    const providers = normalizeAvailableProviders([
      { provider: "codex", enabled: true },
      { provider: "someunknownprovider", displayName: "New", enabled: true },
    ]);

    expect(providers.find((provider) => provider.id === "codex")?.supported).toBe(true);
    expect(providers.find((provider) => provider.cliProvider === "someunknownprovider")?.supported).toBe(false);
  });

  it("orders enabled providers by config order and keeps disabled ones after", () => {
    const providers = normalizeAvailableProviders([
      { provider: "codex", enabled: true },
      { provider: "claude", enabled: true },
      { provider: "grok", enabled: false },
    ]);

    const ordered = orderEnabledProvidersByConfig(providers, ["claude", "codex"]);

    expect(ordered.map((provider) => provider.id)).toEqual(["claude", "codex", "grok"]);
  });

  it("keeps registry-unknown enabled providers after the config-ordered ones", () => {
    const providers = normalizeAvailableProviders([
      { provider: "someunknownprovider", displayName: "New", enabled: true },
      { provider: "codex", enabled: true },
    ]);

    const ordered = orderEnabledProvidersByConfig(providers, ["codex"]);

    expect(ordered.map((provider) => provider.cliProvider)).toEqual(["codex", "someunknownprovider"]);
  });

  it("orders the enabled roster from the CLI to match the config file order", async () => {
    mockExecSuccess(
      JSON.stringify([
        { provider: "codex", enabled: true },
        { provider: "claude", enabled: true },
      ]),
    );
    readFileMock.mockResolvedValue(
      JSON.stringify({
        providers: [
          { id: "claude", enabled: true },
          { id: "codex", enabled: true },
        ],
      }),
    );

    const providers = await listAvailableProviders(binary);

    expect(providers.map((provider) => provider.id)).toEqual(["claude", "codex"]);
  });
});
