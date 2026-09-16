import { Cache } from "@raycast/api";
import { KEYCHAIN_ACCESS_POLICIES, type KeychainAccessPolicy } from "../lib/keychainAccessPolicy";

// Raycast's Cache has no key enumeration, so stores that keep one entry per
// (Keychain policy, provider) also keep an index of provider ids to make
// pruning possible. This wraps that pattern once: schema-versioned keys, the
// index set, legacy-schema sweeps, and per-provider policy loops.

type IndexedCacheOptions = {
  namespace: string;
  schemaVersion: string;
  /** Older schema versions whose per-provider keys (`<schema>:<providerId>`) are swept on prune. */
  legacySchemaVersions?: readonly string[];
};

/**
 * Decide what happens to one stored entry during prune: `undefined` removes it,
 * the same string keeps it, a different string rewrites it.
 */
export type PruneEntry = (serialized: string, providerId: string, policy: KeychainAccessPolicy) => string | undefined;

export type IndexedCache = {
  get(providerId: string, policy: KeychainAccessPolicy): string | undefined;
  set(providerId: string, policy: KeychainAccessPolicy, serialized: string): void;
  /** Removes the entry and drops the provider from the index once no policy scope has one. */
  remove(providerId: string, policy: KeychainAccessPolicy): void;
  /** Visits every tracked provider plus `providerIds`, in every policy scope, and rewrites the index. */
  prune(providerIds: readonly string[], decide: PruneEntry): void;
};

export function createIndexedCache({
  namespace,
  schemaVersion,
  legacySchemaVersions = [],
}: IndexedCacheOptions): IndexedCache {
  const indexKey = `${schemaVersion}:index`;
  // Lazy so importing a store never constructs a Cache — test setups that stub
  // @raycast/api without a Cache export import some stores transitively.
  let cache: Cache | undefined;

  function getCache(): Cache {
    cache ??= new Cache({ namespace });
    return cache;
  }

  function buildKey(providerId: string, policy: KeychainAccessPolicy): string {
    return `${schemaVersion}:${policy}:${providerId}`;
  }

  function readIndex(): Set<string> {
    const serialized = getCache().get(indexKey);
    if (!serialized) return new Set();

    try {
      const providerIds = JSON.parse(serialized) as unknown;
      if (!Array.isArray(providerIds) || !providerIds.every((providerId) => typeof providerId === "string")) {
        throw new Error(`invalid ${namespace} index`);
      }
      return new Set(providerIds);
    } catch {
      getCache().remove(indexKey);
      return new Set();
    }
  }

  function writeIndex(providerIds: Set<string>): void {
    if (providerIds.size === 0) {
      getCache().remove(indexKey);
      return;
    }
    getCache().set(indexKey, JSON.stringify([...providerIds]));
  }

  function hasAnyEntry(providerId: string): boolean {
    return KEYCHAIN_ACCESS_POLICIES.some((policy) => Boolean(getCache().get(buildKey(providerId, policy))));
  }

  function untrackIfEmpty(providerId: string): void {
    if (hasAnyEntry(providerId)) return;
    const providerIds = readIndex();
    providerIds.delete(providerId);
    writeIndex(providerIds);
  }

  return {
    get(providerId, policy) {
      return getCache().get(buildKey(providerId, policy));
    },

    set(providerId, policy, serialized) {
      getCache().set(buildKey(providerId, policy), serialized);
      const providerIds = readIndex();
      providerIds.add(providerId);
      writeIndex(providerIds);
    },

    remove(providerId, policy) {
      getCache().remove(buildKey(providerId, policy));
      untrackIfEmpty(providerId);
    },

    prune(providerIds, decide) {
      const tracked = readIndex();
      const toVisit = new Set([...tracked, ...providerIds]);

      for (const providerId of toVisit) {
        for (const legacySchema of legacySchemaVersions) {
          getCache().remove(`${legacySchema}:${providerId}`);
        }

        for (const policy of KEYCHAIN_ACCESS_POLICIES) {
          const key = buildKey(providerId, policy);
          const serialized = getCache().get(key);
          if (!serialized) continue;

          const next = decide(serialized, providerId, policy);
          if (next === undefined) {
            getCache().remove(key);
          } else if (next !== serialized) {
            getCache().set(key, next);
          }
        }

        if (!hasAnyEntry(providerId)) {
          tracked.delete(providerId);
        }
      }

      writeIndex(tracked);
    },
  };
}
