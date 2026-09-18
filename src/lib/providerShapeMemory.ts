import { createIndexedCache } from "../cache/indexedCache";
import type { ProviderDetailData, ProviderSupplementalUsageSection } from "../providers/types";
import type { KeychainAccessPolicy } from "./keychainAccessPolicy";

// Per-provider section memory (ADR-0007): upstream fetches sometimes drop
// supplemental sections, so we restore remembered ones until they age out
const shapeMemoryCache = createIndexedCache({
  namespace: "provider-shape-memory",
  schemaVersion: "usage-sections-v2",
  legacySchemaVersions: ["usage-sections-v1"],
});

export const SECTION_MEMORY_TTL_MS = 24 * 60 * 60 * 1000;

type RememberedSection = {
  key: string;
  section: ProviderSupplementalUsageSection;
  index: number;
  lastSeenAt: number;
};

type SectionMemoryStore = {
  identity: string;
  entries: RememberedSection[];
};

// Sections must never be restored across a different account or resolved
// source: that would render one identity's meters under another's header.
function buildMemoryIdentity(detail: ProviderDetailData): string {
  return `${detail.source ?? ""}:${detail.accountEmail ?? ""}`;
}

function parseSectionMemoryStore(serialized: string): SectionMemoryStore | undefined {
  try {
    const parsed = JSON.parse(serialized) as SectionMemoryStore;
    if (typeof parsed.identity !== "string" || !Array.isArray(parsed.entries)) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function readRememberedSections(
  providerId: string,
  identity: string,
  keychainAccessPolicy: KeychainAccessPolicy,
): RememberedSection[] {
  const serialized = shapeMemoryCache.get(providerId, keychainAccessPolicy);
  if (!serialized) {
    return [];
  }

  const store = parseSectionMemoryStore(serialized);
  if (!store) {
    shapeMemoryCache.remove(providerId, keychainAccessPolicy);
    return [];
  }

  return store.identity === identity ? store.entries.filter(isRememberedSection) : [];
}

/** Track which supplemental usage sections appear in detail, and restore any recently seen ones it dropped. */
export function applyProviderUsageSectionMemory(
  detail: ProviderDetailData,
  keychainAccessPolicy: KeychainAccessPolicy,
  now = Date.now(),
): ProviderDetailData {
  const identity = buildMemoryIdentity(detail);
  const remembered = readRememberedSections(detail.id, identity, keychainAccessPolicy).filter(
    (entry) => now - entry.lastSeenAt <= SECTION_MEMORY_TTL_MS,
  );

  const presentKeys = new Set<string>();
  const updated = new Map(remembered.map((entry) => [entry.key, entry] as const));
  detail.sections.forEach((section, index) => {
    // Only supplemental usage meters flake upstream; info sections carry
    // mutable inventory (credits, balances) that must never be resurrected.
    if (section.kind !== "supplementalUsage") {
      return;
    }

    presentKeys.add(section.title);
    updated.set(section.title, { key: section.title, section, index, lastSeenAt: now });
  });

  const store: SectionMemoryStore = { identity, entries: [...updated.values()] };
  if (store.entries.length > 0) {
    shapeMemoryCache.set(detail.id, keychainAccessPolicy, JSON.stringify(store));
  } else {
    shapeMemoryCache.remove(detail.id, keychainAccessPolicy);
  }

  const missing = remembered
    .filter((entry) => !presentKeys.has(entry.key))
    .sort((left, right) => left.index - right.index);
  if (missing.length === 0) {
    return detail;
  }

  const sections = [...detail.sections];
  for (const entry of missing) {
    sections.splice(Math.min(entry.index, sections.length), 0, entry.section);
  }

  return { ...detail, sections };
}

export function pruneProviderUsageSectionMemory(providerIds: string[] = [], now = Date.now()): void {
  shapeMemoryCache.prune(providerIds, (serialized) => {
    const store = parseSectionMemoryStore(serialized);
    if (!store) {
      return undefined;
    }

    const entries = store.entries.filter(
      (entry) => isRememberedSection(entry) && now - entry.lastSeenAt <= SECTION_MEMORY_TTL_MS,
    );
    if (entries.length === 0) {
      return undefined;
    }

    return entries.length === store.entries.length
      ? serialized
      : JSON.stringify({ ...store, entries } satisfies SectionMemoryStore);
  });
}

function isRememberedSection(entry: unknown): entry is RememberedSection {
  if (!entry || typeof entry !== "object") return false;
  const candidate = entry as Partial<RememberedSection>;
  return (
    typeof candidate.key === "string" &&
    typeof candidate.index === "number" &&
    Number.isInteger(candidate.index) &&
    typeof candidate.lastSeenAt === "number" &&
    Number.isFinite(candidate.lastSeenAt) &&
    candidate.section?.kind === "supplementalUsage"
  );
}
