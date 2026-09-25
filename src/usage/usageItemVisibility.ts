import type { ProviderSection, ProviderUsageSectionTitle } from "./types";

// ProviderUsageItemID (ProviderUsageItemVisibility.swift). See docs/upstream-parity.md.

const CODEX_SESSION_WINDOW_MINUTES = 5 * 60;
const CODEX_WEEKLY_WINDOW_MINUTES = 7 * 24 * 60;
const CODEX_MONTHLY_WINDOW_MINUTES = 30 * 24 * 60;

const STORED_USAGE_ITEM_PREFIXES = ["metric:", "section:", "detailSection:"] as const;

const SLOT_USAGE_ITEM_IDS: Record<ProviderUsageSectionTitle, string> = {
  Primary: "metric:primary",
  Secondary: "metric:secondary",
  Tertiary: "metric:tertiary",
};

// CodexConsumerProjection.classifyRateWindow.
function codexLaneId(slot: "Primary" | "Secondary", windowMinutes: number | undefined): string {
  if (windowMinutes === CODEX_SESSION_WINDOW_MINUTES) {
    return "primary";
  }
  if (windowMinutes === CODEX_WEEKLY_WINDOW_MINUTES) {
    return "secondary";
  }
  if (windowMinutes === CODEX_MONTHLY_WINDOW_MINUTES) {
    return "monthly";
  }
  return slot === "Primary" ? "primary" : "secondary";
}

export function usageItemIdForSlot(
  providerId: string,
  slot: ProviderUsageSectionTitle,
  windowMinutes?: number,
): string {
  if (providerId === "codex" && slot !== "Tertiary") {
    return `metric:${codexLaneId(slot, windowMinutes)}`;
  }

  return SLOT_USAGE_ITEM_IDS[slot];
}

// Presentation supplemental meters prefix the window id with `extra:`.
export function usageItemIdFromMeterId(meterId: string | undefined): string | undefined {
  const trimmed = meterId?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (STORED_USAGE_ITEM_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return trimmed;
  }

  const bare = trimmed.startsWith("extra:") ? trimmed.slice("extra:".length).trim() : trimmed;
  return bare ? `metric:${bare}` : undefined;
}

// Cached details from before usageItemId still match these by title.
export function resolveUsageItemId(section: ProviderSection): string | undefined {
  if (section.usageItemId) {
    return section.usageItemId;
  }
  if (section.kind === "usage") {
    return SLOT_USAGE_ITEM_IDS[section.title];
  }
  if (section.kind === "info" && section.title === "Limit Reset Credits") {
    return "section:codex-reset-credits";
  }
  if (section.kind === "supplementalUsage" && section.title === "Code review") {
    return "metric:code-review";
  }
  return undefined;
}

export function omitHiddenUsageItems(
  sections: ProviderSection[],
  hiddenUsageItemIDs: readonly string[] | undefined,
): ProviderSection[] {
  if (!hiddenUsageItemIDs?.length) {
    return sections;
  }

  const hidden = new Set(hiddenUsageItemIDs);
  return sections.filter((section) => {
    const usageItemId = resolveUsageItemId(section);
    return usageItemId === undefined || !hidden.has(usageItemId);
  });
}
