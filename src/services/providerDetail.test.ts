import { Cache } from "@raycast/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedCodexBarBinary } from "../cli/binary";
import { CodexBarCliError } from "../cli/exec";
import type { CodexBarClient } from "./codexbarClient";
import { KEYCHAIN_ACCESS_DISABLED_PROVIDER_ERROR_HINT, loadProviderDetail } from "./providerDetail";

function makeClient(
  payload: unknown | (() => Promise<unknown>),
  keychainAccessPolicy: ResolvedCodexBarBinary["keychainAccessPolicy"] = "default",
): CodexBarClient & { fetchUsage: ReturnType<typeof vi.fn> } {
  const fetchUsage = vi.fn(typeof payload === "function" ? (payload as () => Promise<unknown>) : async () => payload);
  return {
    binary: { command: "codexbar", source: "path", keychainAccessPolicy },
    readConfiguredProviders: async () => [],
    listAvailableProviders: async () => [],
    setProviderEnabled: async () => undefined,
    moveConfiguredProvider: async () => false,
    ensureServe: async () => false,
    fetchUsage,
  };
}

const CODEX_PAYLOAD = {
  provider: "codex",
  usage: {
    primary: { usedPercent: 40, resetsAt: "2026-04-15T15:00:00Z" },
    secondary: { usedPercent: 10, resetsAt: "2026-04-20T12:00:00Z" },
  },
  status: { indicator: "minor", description: "Degraded" },
};

describe("loadProviderDetail", () => {
  beforeEach(() => {
    new Cache({ namespace: "provider-shape-memory" }).clear();
  });

  it("normalizes the raw payload, forwards fetch options, and stamps the requested source", async () => {
    const client = makeClient(CODEX_PAYLOAD);

    const { detail, status } = await loadProviderDetail(client, " codex ", {
      mode: "force",
      source: "cli",
      interaction: "user",
    });

    expect(client.fetchUsage).toHaveBeenCalledWith("codex", { mode: "force", source: "cli", interaction: "user" });
    expect(detail).toMatchObject({ id: "codex", requestedSource: "cli" });
    expect(detail.sections.filter((section) => section.kind === "usage")).toHaveLength(2);
    expect(status).toBeUndefined();
  });

  it("extracts status only when asked for", async () => {
    const { status } = await loadProviderDetail(makeClient(CODEX_PAYLOAD), "codex", { includeStatus: true });

    expect(status).toMatchObject({ indicator: "minor", description: "Degraded" });
  });

  it("rejects selector ids before touching the client", async () => {
    const client = makeClient(CODEX_PAYLOAD);

    await expect(loadProviderDetail(client, "all")).rejects.toThrow(CodexBarCliError);
    expect(client.fetchUsage).not.toHaveBeenCalled();
  });

  it("turns a payload-level error into a CodexBarCliError", async () => {
    await expect(
      loadProviderDetail(makeClient({ provider: "codex", error: "Not logged in" }), "codex"),
    ).rejects.toMatchObject({ kind: "execution", message: "Not logged in" });
  });

  it("appends the Keychain hint once when the policy is disabled", async () => {
    const client = makeClient(async () => {
      throw new Error("keychain locked");
    }, "disabled");

    await expect(loadProviderDetail(client, "codex")).rejects.toThrow(
      `keychain locked\n\n${KEYCHAIN_ACCESS_DISABLED_PROVIDER_ERROR_HINT}`,
    );

    const already = makeClient(async () => {
      throw new Error(`nope\n\n${KEYCHAIN_ACCESS_DISABLED_PROVIDER_ERROR_HINT}`);
    }, "disabled");
    await expect(loadProviderDetail(already, "codex")).rejects.toThrow(
      `nope\n\n${KEYCHAIN_ACCESS_DISABLED_PROVIDER_ERROR_HINT}`,
    );
  });
});
