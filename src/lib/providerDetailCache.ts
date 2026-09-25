import { Cache } from "@raycast/api";
import { createIndexedCache } from "../cache/indexedCache";
import type { ProviderDetailData, ProviderSourceMode } from "../providers/types";
import type { KeychainAccessPolicy } from "../cli/keychainAccessPolicy";

export const PROVIDER_DETAIL_CONCURRENCY = 4;
const PROVIDER_DETAIL_FRESHNESS_WINDOW_MS = 10 * 60 * 1000;
export const PROVIDER_DETAIL_STALE_WINDOW_MS = 60 * 60 * 1000;
const PROVIDER_DETAIL_SCHEMA_VERSION = "provider-details-v8";
const providerDetailCache = createIndexedCache({
  namespace: "provider-details",
  schemaVersion: PROVIDER_DETAIL_SCHEMA_VERSION,
  legacySchemaVersions: ["provider-details-v7"],
});
const providerDetailFailureCache = new Cache({ namespace: "provider-detail-failures" });

export type ProviderDetailCacheStatus = "fresh" | "stale";

export type ProviderDetailState = {
  detail?: ProviderDetailData;
  error?: Error;
  isLoading: boolean;
  cacheStatus?: ProviderDetailCacheStatus;
};

export type ProviderDetailResults = Record<string, ProviderDetailState | undefined>;

type FetchProviderDetail = (providerId: string) => Promise<void>;

type RunProviderDetailFetchesOptions = {
  providerIds: string[];
  concurrency?: number;
  fetchProvider: FetchProviderDetail;
  shouldSkip?: (providerId: string) => boolean;
};

export async function runProviderDetailFetches({
  providerIds,
  concurrency = PROVIDER_DETAIL_CONCURRENCY,
  fetchProvider,
  shouldSkip,
}: RunProviderDetailFetchesOptions): Promise<void> {
  const workerCount = Math.min(Math.max(1, concurrency), providerIds.length);
  let nextProviderIndex = 0;

  async function runWorker() {
    while (nextProviderIndex < providerIds.length) {
      const providerId = providerIds[nextProviderIndex];
      nextProviderIndex += 1;

      if (!providerId || shouldSkip?.(providerId)) {
        continue;
      }

      await fetchProvider(providerId);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
}

export function shouldRefreshProviderAutomatically(
  result: ProviderDetailState | undefined,
  completedGeneration: number | undefined,
  currentGeneration: number,
  now = Date.now(),
): boolean {
  if (!result) {
    return completedGeneration !== currentGeneration;
  }

  if (result.isLoading) {
    return false;
  }

  if (result.error) {
    return completedGeneration !== currentGeneration;
  }

  if (!result.detail) {
    return completedGeneration !== currentGeneration;
  }

  return isProviderDetailOlderThan(result.detail, PROVIDER_DETAIL_FRESHNESS_WINDOW_MS, now);
}

export function buildCachedProviderResults(
  providerIds: string[],
  keychainAccessPolicy: KeychainAccessPolicy,
  now = Date.now(),
  requestedSources?: ReadonlyMap<string, ProviderSourceMode>,
): ProviderDetailResults {
  return Object.fromEntries(
    providerIds.flatMap((providerId) => {
      const cachedDetail = readCachedProviderDetail(
        providerId,
        keychainAccessPolicy,
        now,
        requestedSources?.get(providerId),
      );
      return cachedDetail ? [[providerId, { ...cachedDetail, isLoading: false } satisfies ProviderDetailState]] : [];
    }),
  );
}

export function cacheProviderDetail(detail: ProviderDetailData, keychainAccessPolicy: KeychainAccessPolicy): void {
  providerDetailCache.set(detail.id, keychainAccessPolicy, JSON.stringify(detail));
}

export function readCachedProviderDetail(
  providerId: string,
  keychainAccessPolicy: KeychainAccessPolicy,
  now = Date.now(),
  requestedSource?: ProviderSourceMode,
): Pick<ProviderDetailState, "detail" | "cacheStatus"> | undefined {
  const serializedDetail = providerDetailCache.get(providerId, keychainAccessPolicy);
  if (!serializedDetail) {
    return undefined;
  }

  const detail = parseProviderDetail(serializedDetail);
  const cacheStatus = detail ? getProviderDetailCacheStatus(detail, providerId, now) : undefined;
  if (!detail || !cacheStatus) {
    // Unparseable, wrong-provider, wrong-schema, or expired: evict.
    providerDetailCache.remove(providerId, keychainAccessPolicy);
    return undefined;
  }

  // A valid entry fetched under another source is hidden, not evicted.
  if (requestedSource !== undefined && detail.requestedSource !== requestedSource) {
    return undefined;
  }

  return { detail, cacheStatus };
}

function parseProviderDetail(serialized: string): ProviderDetailData | undefined {
  try {
    return JSON.parse(serialized) as ProviderDetailData;
  } catch {
    return undefined;
  }
}

function getProviderDetailCacheStatus(
  detail: ProviderDetailData,
  providerId: string,
  now = Date.now(),
): ProviderDetailCacheStatus | undefined {
  if (detail.id !== providerId || !isProviderDetailSchemaCurrent(detail)) {
    return undefined;
  }

  if (!isProviderDetailOlderThan(detail, PROVIDER_DETAIL_FRESHNESS_WINDOW_MS, now)) {
    return "fresh";
  }

  if (!isProviderDetailOlderThan(detail, PROVIDER_DETAIL_STALE_WINDOW_MS, now)) {
    return "stale";
  }

  return undefined;
}

function isProviderDetailOlderThan(detail: ProviderDetailData, maxAgeMs: number, now = Date.now()): boolean {
  const fetchedAtMs = Date.parse(detail.fetchedAt);
  return Number.isNaN(fetchedAtMs) || now - fetchedAtMs > maxAgeMs;
}

function isProviderDetailSchemaCurrent(detail: ProviderDetailData): boolean {
  return (
    Array.isArray(detail.sections) &&
    detail.sections.every(
      (section) => section?.kind === "usage" || section?.kind === "supplementalUsage" || section?.kind === "info",
    )
  );
}

export function recordProviderDetailSuccess(providerId: string, keychainAccessPolicy: KeychainAccessPolicy): void {
  providerDetailFailureCache.remove(buildProviderDetailFailureKey(providerId, keychainAccessPolicy));
}

export function recordProviderDetailFailure(providerId: string, keychainAccessPolicy: KeychainAccessPolicy): number {
  const key = buildProviderDetailFailureKey(providerId, keychainAccessPolicy);
  const previous = Number.parseInt(providerDetailFailureCache.get(key) ?? "0", 10);
  const count = Number.isFinite(previous) ? previous + 1 : 1;
  providerDetailFailureCache.set(key, String(count));
  return count;
}

export function shouldSurfaceProviderDetailFailure(hasCachedDetail: boolean, consecutiveFailures: number): boolean {
  return !hasCachedDetail || consecutiveFailures >= 2;
}

function buildProviderDetailFailureKey(providerId: string, keychainAccessPolicy: KeychainAccessPolicy): string {
  return `${PROVIDER_DETAIL_SCHEMA_VERSION}:${keychainAccessPolicy}:${providerId}`;
}

export function pruneProviderDetailCaches(providerIds: string[] = [], now = Date.now()): void {
  providerDetailCache.prune(providerIds, (serialized, providerId) => {
    const detail = parseProviderDetail(serialized);
    return detail && getProviderDetailCacheStatus(detail, providerId, now) ? serialized : undefined;
  });
}
