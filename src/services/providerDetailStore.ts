import {
  buildCachedProviderResults,
  cacheProviderDetail,
  PROVIDER_DETAIL_CONCURRENCY,
  pruneProviderDetailCaches,
  recordProviderDetailFailure,
  recordProviderDetailSuccess,
  runProviderDetailFetches,
  shouldRefreshProviderAutomatically,
  shouldSurfaceProviderDetailFailure,
  type ProviderDetailResults,
  type ProviderDetailState,
} from "../cache/providerDetailCache";
import { pruneProviderUsageSectionMemory } from "../cache/sectionMemory";
import type { ConfiguredProvider, ProviderSourceMode } from "../usage/types";
import type { CodexBarClient } from "./codexbarClient";
import { loadProviderDetail as defaultLoadProviderDetail, type LoadProviderDetailOptions } from "./providerDetail";

// Framework-free scheduler behind the Usage Overview's per-provider details.
// It owns the rules the React hook used to spread over eleven refs:
//
// - one in-flight fetch per provider; a second request while one is running
//   only records that a forced follow-up is wanted (force after auto);
// - results are discarded when the CodexBar client changed underneath them or
//   the provider left the configured list (a Keychain preference flip must never
//   show data fetched under the previous policy);
// - each time the command opens with a given client, every provider is
//   force-refreshed exactly once per (client, provider, source); later batches
//   only refetch what shouldRefreshProviderAutomatically says is stale;
// - cached details render immediately as optimistic results (fresh or stale)
//   until a live result replaces them;
// - the first failure over a cached detail is swallowed, repeated ones surface.

export type ProviderDetailSnapshot = {
  results: ProviderDetailResults;
  isLoading: boolean;
};

export type ProviderDetailContext = {
  client: CodexBarClient | undefined;
  providers: ConfiguredProvider[];
};

export type ProviderDetailStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ProviderDetailSnapshot;
  /** Replace client + providers. Starts the once-per-open refresh batch when either changed. */
  setContext(context: ProviderDetailContext): void;
  /** Fetch when the current result is missing, failed, or older than the freshness window. */
  ensureFresh(providerId: string): void;
  refresh(providerId: string, options?: { force?: boolean }): void;
};

export type ProviderDetailStoreDeps = {
  loadProviderDetail?: (
    client: CodexBarClient,
    providerId: string,
    options: LoadProviderDetailOptions,
  ) => Promise<{ detail: ProviderDetailState["detail"] & object }>;
  now?: () => number;
};

type InFlightFetch = {
  clientKey: string;
  mode: "auto" | "force";
  pendingForce: boolean;
};

function buildClientKey(client: CodexBarClient | undefined): string {
  if (!client) {
    return "";
  }
  const { source, command, keychainAccessPolicy, capabilities } = client.binary;
  return `${source}\0${command}\0${keychainAccessPolicy}\0${JSON.stringify(capabilities ?? null)}`;
}

function buildProvidersKey(providers: ConfiguredProvider[]): string {
  return providers.map((provider) => `${provider.id}\0${provider.source ?? "auto"}`).join("\u0001");
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function createProviderDetailStore(deps: ProviderDetailStoreDeps = {}): ProviderDetailStore {
  const loadProviderDetail = deps.loadProviderDetail ?? defaultLoadProviderDetail;
  const now = deps.now ?? Date.now;

  let client: CodexBarClient | undefined;
  let clientKey = "";
  let providersKey = "";
  let providerIds: string[] = [];
  let providerIdSet = new Set<string>();
  let providerSources = new Map<string, ProviderSourceMode>();

  let optimistic: ProviderDetailResults = {};
  let live: ProviderDetailResults = {};
  let batchLoading = false;
  let snapshot: ProviderDetailSnapshot = { results: {}, isLoading: false };

  // One batch per context change. Completion is tracked per batch so a
  // selected provider that already completed in this batch is not refetched.
  let batch = 0;
  const completedInBatch = new Set<string>();
  const inFlight = new Map<string, InFlightFetch>();
  const openRefreshClaims = new Set<string>();
  const listeners = new Set<() => void>();

  function emit(): void {
    snapshot = {
      results: { ...optimistic, ...live },
      isLoading: batchLoading || Object.values(live).some((result) => result?.isLoading),
    };
    for (const listener of listeners) {
      listener();
    }
  }

  function setLive(
    providerId: string,
    update: (current: ProviderDetailState | undefined) => ProviderDetailState,
  ): void {
    live = { ...live, [providerId]: update(live[providerId] ?? optimistic[providerId]) };
    emit();
  }

  function canApply(providerId: string, fetch: InFlightFetch): boolean {
    return inFlight.get(providerId) === fetch && fetch.clientKey === clientKey && providerIdSet.has(providerId);
  }

  async function fetchOne(providerId: string, options?: { force?: boolean }): Promise<void> {
    const currentClient = client;
    if (!currentClient || !providerId) {
      return;
    }

    const force = options?.force === true;
    // A fetch started under a previous client is superseded, not joined: its
    // result would be discarded anyway, and the new client needs its own data.
    const running = inFlight.get(providerId);
    if (running && running.clientKey === clientKey) {
      if (force && running.mode !== "force") {
        running.pendingForce = true;
      }
      setLive(providerId, (current) => ({ ...current, error: undefined, isLoading: true }));
      return;
    }

    const fetch: InFlightFetch = { clientKey, mode: force ? "force" : "auto", pendingForce: false };
    inFlight.set(providerId, fetch);
    setLive(providerId, (current) => ({ ...current, error: undefined, isLoading: true }));

    try {
      const { detail } = await loadProviderDetail(currentClient, providerId, {
        mode: fetch.mode,
        source: providerSources.get(providerId),
        interaction: "user",
      });
      if (!canApply(providerId, fetch)) {
        clearLoading(providerId, fetch);
        return;
      }

      completedInBatch.add(providerId);
      recordProviderDetailSuccess(providerId, currentClient.binary.keychainAccessPolicy);
      cacheProviderDetail(detail, currentClient.binary.keychainAccessPolicy);
      setLive(providerId, () => ({ detail, isLoading: false, cacheStatus: "fresh" }));
    } catch (error) {
      if (!canApply(providerId, fetch)) {
        clearLoading(providerId, fetch);
        return;
      }

      completedInBatch.add(providerId);
      const previous = live[providerId] ?? optimistic[providerId];
      const failureCount = recordProviderDetailFailure(providerId, currentClient.binary.keychainAccessPolicy);
      const surfaced = shouldSurfaceProviderDetailFailure(Boolean(previous?.detail), failureCount)
        ? toError(error)
        : undefined;
      setLive(providerId, () => ({ ...previous, error: surfaced, isLoading: false }));
    } finally {
      const chainForce = inFlight.get(providerId) === fetch && fetch.pendingForce && fetch.mode !== "force";
      if (inFlight.get(providerId) === fetch) {
        inFlight.delete(providerId);
      }
      if (chainForce) {
        void fetchOne(providerId, { force: true });
      }
    }
  }

  function clearLoading(providerId: string, fetch: InFlightFetch): void {
    if (inFlight.get(providerId) !== fetch) {
      return;
    }
    const current = live[providerId];
    if (current?.isLoading) {
      live = { ...live, [providerId]: { ...current, isLoading: false } };
      emit();
    }
  }

  async function fetchIfStale(providerId: string): Promise<void> {
    const result = snapshot.results[providerId];
    const completedGeneration = completedInBatch.has(providerId) ? batch : undefined;
    if (shouldRefreshProviderAutomatically(result, completedGeneration, batch, now())) {
      await fetchOne(providerId);
    }
  }

  async function refreshOnOpen(providerId: string): Promise<void> {
    const claim = `${clientKey}\0${providerId}\0${providerSources.get(providerId) ?? "auto"}`;
    if (!openRefreshClaims.has(claim)) {
      openRefreshClaims.add(claim);
      await fetchOne(providerId, { force: true });
      return;
    }

    await fetchIfStale(providerId);
  }

  function startBatch(): void {
    batch += 1;
    const thisBatch = batch;
    completedInBatch.clear();
    live = Object.fromEntries(Object.entries(live).filter(([providerId]) => inFlight.has(providerId)));

    if (!clientKey || providerIds.length === 0) {
      batchLoading = false;
      emit();
      return;
    }

    batchLoading = true;
    emit();
    void runProviderDetailFetches({
      providerIds,
      concurrency: PROVIDER_DETAIL_CONCURRENCY,
      fetchProvider: refreshOnOpen,
    }).finally(() => {
      if (batch === thisBatch) {
        batchLoading = false;
        emit();
      }
    });
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      return snapshot;
    },

    setContext(context) {
      const nextClientKey = buildClientKey(context.client);
      const nextProvidersKey = buildProvidersKey(context.providers);
      const changed = nextClientKey !== clientKey || nextProvidersKey !== providersKey;
      const providersChanged = nextProvidersKey !== providersKey;

      client = context.client;
      clientKey = nextClientKey;
      providersKey = nextProvidersKey;
      providerIds = context.providers.map((provider) => provider.id);
      providerIdSet = new Set(providerIds);
      providerSources = new Map(context.providers.map((provider) => [provider.id, provider.source ?? "auto"]));

      if (!changed) {
        return;
      }

      if (providersChanged) {
        pruneProviderDetailCaches(providerIds, now());
        pruneProviderUsageSectionMemory(providerIds);
      }

      const policy = context.client?.binary.keychainAccessPolicy;
      optimistic = policy ? buildCachedProviderResults(providerIds, policy, now(), providerSources) : {};
      startBatch();
    },

    ensureFresh(providerId) {
      if (clientKey && providerId) {
        void fetchIfStale(providerId);
      }
    },

    refresh(providerId, options) {
      if (providerId) {
        void fetchOne(providerId, options);
      }
    },
  };
}
