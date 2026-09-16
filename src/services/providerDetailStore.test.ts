import { Cache } from "@raycast/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheProviderDetail } from "../cache/providerDetailCache";
import type { ConfiguredProvider, ProviderDetailData } from "../usage/types";
import type { CodexBarClient } from "./codexbarClient";
import { createProviderDetailStore } from "./providerDetailStore";

const NOW = Date.parse("2026-04-15T12:00:00Z");

function makeClient(command = "codexbar", keychainAccessPolicy: "default" | "disabled" = "default"): CodexBarClient {
  return {
    binary: { command, source: "path", keychainAccessPolicy },
    readConfiguredProviders: async () => [],
    listAvailableProviders: async () => [],
    setProviderEnabled: async () => undefined,
    moveConfiguredProvider: async () => false,
    ensureServe: async () => false,
    fetchUsage: async () => ({}),
  };
}

function provider(id: string): ConfiguredProvider {
  return { id, name: id, icon: "icon" };
}

function makeDetail(id: string, fetchedAt = new Date(NOW).toISOString()): ProviderDetailData {
  return {
    id,
    name: id,
    fetchedAt,
    requestedSource: "auto",
    sections: [{ kind: "usage", title: "Primary", displayTitle: "Session", remainingPercent: 50 }],
  };
}

type Deferred = { resolve: (detail: ProviderDetailData) => void; reject: (error: Error) => void };

function makeLoader() {
  const calls: Array<{ providerId: string; mode?: string; deferred: Deferred }> = [];
  const load = vi.fn((_client: CodexBarClient, providerId: string, options: { mode?: "auto" | "force" }) => {
    return new Promise<{ detail: ProviderDetailData }>((resolve, reject) => {
      calls.push({
        providerId,
        mode: options.mode,
        deferred: { resolve: (detail) => resolve({ detail }), reject },
      });
    });
  });
  return { load, calls };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createProviderDetailStore", () => {
  beforeEach(() => {
    new Cache({ namespace: "provider-details" }).clear();
    new Cache({ namespace: "provider-detail-failures" }).clear();
    new Cache({ namespace: "provider-shape-memory" }).clear();
  });

  it("force-refreshes every provider once when the command opens and marks them loading", async () => {
    const { load, calls } = makeLoader();
    const store = createProviderDetailStore({ loadProviderDetail: load, now: () => NOW });

    store.setContext({ client: makeClient(), providers: [provider("codex"), provider("claude")] });
    await flush();

    expect(calls.map((call) => [call.providerId, call.mode])).toEqual([
      ["codex", "force"],
      ["claude", "force"],
    ]);
    expect(store.getSnapshot().isLoading).toBe(true);
    expect(store.getSnapshot().results.codex).toMatchObject({ isLoading: true });

    calls[0].deferred.resolve(makeDetail("codex"));
    calls[1].deferred.resolve(makeDetail("claude"));
    await flush();

    expect(store.getSnapshot().isLoading).toBe(false);
    expect(store.getSnapshot().results.codex).toMatchObject({ isLoading: false, cacheStatus: "fresh" });
  });

  it("renders cached details immediately and does not force-refresh again for the same client and source", async () => {
    cacheProviderDetail(makeDetail("codex"), "default");
    const { load, calls } = makeLoader();
    const store = createProviderDetailStore({ loadProviderDetail: load, now: () => NOW });
    const client = makeClient();

    store.setContext({ client, providers: [provider("codex")] });
    expect(store.getSnapshot().results.codex).toMatchObject({ cacheStatus: "fresh", isLoading: true });
    await flush();
    expect(calls).toHaveLength(1);
    calls[0].deferred.resolve(makeDetail("codex"));
    await flush();

    // A second batch for the same client (providers reordered) only refetches stale data.
    store.setContext({ client, providers: [provider("codex"), provider("claude")] });
    await flush();

    expect(calls.map((call) => call.providerId)).toEqual(["codex", "claude"]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("dedupes concurrent fetches and chains one forced fetch after an automatic one", async () => {
    const { load, calls } = makeLoader();
    const store = createProviderDetailStore({ loadProviderDetail: load, now: () => NOW });
    store.setContext({ client: makeClient(), providers: [provider("codex")] });
    await flush();
    calls[0].deferred.resolve(makeDetail("codex"));
    await flush();

    // Stale cached result -> ensureFresh starts an automatic fetch.
    cacheProviderDetail(makeDetail("codex", "2026-04-15T11:00:00Z"), "default");
    const laterStore = createProviderDetailStore({ loadProviderDetail: load, now: () => NOW });
    laterStore.setContext({ client: makeClient("other-binary"), providers: [provider("codex")] });
    await flush();
    const forced = calls.at(-1);
    expect(forced?.mode).toBe("force");
    forced?.deferred.resolve(makeDetail("codex", "2026-04-15T11:00:00Z"));
    await flush();

    laterStore.ensureFresh("codex");
    await flush();
    const auto = calls.at(-1);
    expect(auto?.mode).toBe("auto");

    laterStore.refresh("codex");
    laterStore.refresh("codex", { force: true });
    await flush();
    expect(load).toHaveBeenCalledTimes(calls.length);
    expect(calls.at(-1)).toBe(auto);

    auto?.deferred.resolve(makeDetail("codex"));
    await flush();
    expect(calls.at(-1)?.mode).toBe("force");
    expect(calls.at(-1)).not.toBe(auto);
  });

  it("discards results that finish after the client changed", async () => {
    const { load, calls } = makeLoader();
    const store = createProviderDetailStore({ loadProviderDetail: load, now: () => NOW });

    store.setContext({ client: makeClient("codexbar", "default"), providers: [provider("codex")] });
    await flush();
    const underDefault = calls[0];

    store.setContext({ client: makeClient("codexbar", "disabled"), providers: [provider("codex")] });
    await flush();
    expect(calls).toHaveLength(2);

    underDefault.deferred.resolve(makeDetail("codex"));
    await flush();
    expect(store.getSnapshot().results.codex).toMatchObject({ isLoading: true });
    expect(store.getSnapshot().results.codex?.detail).toBeUndefined();

    calls[1].deferred.resolve(makeDetail("codex"));
    await flush();
    expect(store.getSnapshot().results.codex).toMatchObject({ isLoading: false, cacheStatus: "fresh" });
  });

  it("swallows the first failure over cached data and surfaces the second", async () => {
    cacheProviderDetail(makeDetail("codex"), "default");
    const { load, calls } = makeLoader();
    const store = createProviderDetailStore({ loadProviderDetail: load, now: () => NOW });
    store.setContext({ client: makeClient(), providers: [provider("codex")] });
    await flush();

    calls[0].deferred.reject(new Error("boom"));
    await flush();
    expect(store.getSnapshot().results.codex).toMatchObject({ isLoading: false, error: undefined });
    expect(store.getSnapshot().results.codex?.detail).toBeDefined();

    store.refresh("codex", { force: true });
    await flush();
    calls[1].deferred.reject(new Error("boom again"));
    await flush();
    expect(store.getSnapshot().results.codex?.error?.message).toBe("boom again");
    expect(store.getSnapshot().results.codex?.detail).toBeDefined();
  });

  it("returns a stable snapshot between emits and notifies subscribers", async () => {
    const { load, calls } = makeLoader();
    const store = createProviderDetailStore({ loadProviderDetail: load, now: () => NOW });
    const listener = vi.fn();
    store.subscribe(listener);

    const before = store.getSnapshot();
    expect(store.getSnapshot()).toBe(before);

    store.setContext({ client: makeClient(), providers: [provider("codex")] });
    await flush();
    expect(listener).toHaveBeenCalled();
    expect(store.getSnapshot()).not.toBe(before);

    calls[0].deferred.resolve(makeDetail("codex"));
    await flush();
    const after = store.getSnapshot();
    expect(store.getSnapshot()).toBe(after);
  });
});
