import { formatCountdown } from "../../usage/duration";
import { clampPercent, firstString, toFiniteNumber, toNonBlankString, toRecord } from "../../usage/json";
import type { ProviderSection, ProviderSectionItem, RawProviderPayload } from "../../usage/types";
import type { ProviderModule } from "../module";

const SESSION_WINDOW_MINUTES = 5 * 60;
const WEEKLY_WINDOW_MINUTES = 7 * 24 * 60;
const MONTHLY_WINDOW_MINUTES = 30 * 24 * 60;

// CodexConsumerProjection.rateTitle.
export const displayTitle: NonNullable<ProviderModule["displayTitle"]> = (slotTitle, options) => {
  if (slotTitle !== "Primary" && slotTitle !== "Secondary") {
    return undefined;
  }

  const windowMinutes = options.windows[slotTitle].windowMinutes;
  if (windowMinutes === SESSION_WINDOW_MINUTES) {
    return "Session";
  }

  if (windowMinutes === WEEKLY_WINDOW_MINUTES) {
    return "Weekly";
  }

  if (windowMinutes === MONTHLY_WINDOW_MINUTES) {
    return "Monthly";
  }

  return undefined;
};

// CodexConsumerProjection.classifyRateWindow. Any other duration stays on its slot.
function codexLaneId(slot: "Primary" | "Secondary", windowMinutes: number | undefined): string {
  if (windowMinutes === SESSION_WINDOW_MINUTES) {
    return "primary";
  }
  if (windowMinutes === WEEKLY_WINDOW_MINUTES) {
    return "secondary";
  }
  if (windowMinutes === MONTHLY_WINDOW_MINUTES) {
    return "monthly";
  }
  return slot === "Primary" ? "primary" : "secondary";
}

function stampCodexLaneIds(sections: ProviderSection[]): ProviderSection[] {
  return sections.map((section) => {
    if (section.kind !== "usage" || section.title === "Tertiary") {
      return section;
    }

    const usageItemId = `metric:${codexLaneId(section.title, section.windowMinutes)}`;
    return section.usageItemId === usageItemId ? section : { ...section, usageItemId };
  });
}

// CodexConsumerProjection.weeklyCapsSession: weekly is the binding cap while remaining
// is 0 and the weekly reset is still in the future (or unknown).
function codexWeeklyCapsSession(
  weeklyRemainingPercent: number,
  weeklyResetsAt: string | undefined,
  now: number,
): boolean {
  if (weeklyRemainingPercent > 0) {
    return false;
  }

  if (!weeklyResetsAt) {
    return true;
  }

  const resetMs = Date.parse(weeklyResetsAt);
  if (Number.isNaN(resetMs)) {
    return true;
  }

  return resetMs > now;
}

// CodexConsumerProjection.bindingReset: when session still has headroom, retarget to
// weekly's reset; when both are exhausted, prefer the later of the two known resets.
function codexBindingResetsAt(
  sessionRemainingPercent: number,
  sessionResetsAt: string | undefined,
  weeklyResetsAt: string | undefined,
  now: number,
): string | undefined {
  const sessionResetMs = sessionResetsAt ? Date.parse(sessionResetsAt) : Number.NaN;
  const sessionResetFuture = !sessionResetsAt || Number.isNaN(sessionResetMs) ? true : sessionResetMs > now;
  const sessionIsExhausted = sessionRemainingPercent <= 0 && sessionResetFuture;

  if (!sessionIsExhausted) {
    return weeklyResetsAt;
  }

  if (!sessionResetsAt || !weeklyResetsAt) {
    return undefined;
  }

  const weeklyResetMs = Date.parse(weeklyResetsAt);
  if (Number.isNaN(sessionResetMs) || Number.isNaN(weeklyResetMs)) {
    return undefined;
  }

  return sessionResetMs > weeklyResetMs ? sessionResetsAt : weeklyResetsAt;
}

function applyCodexWeeklySessionCap(sections: ProviderSection[], now: number): ProviderSection[] {
  const primaryIndex = sections.findIndex((section) => section.kind === "usage" && section.title === "Primary");
  const secondaryIndex = sections.findIndex((section) => section.kind === "usage" && section.title === "Secondary");
  if (primaryIndex < 0 || secondaryIndex < 0) {
    return sections;
  }

  const primary = sections[primaryIndex];
  const secondary = sections[secondaryIndex];
  if (primary.kind !== "usage" || secondary.kind !== "usage") {
    return sections;
  }

  const weeklyResetsAt = secondary.resetsAt;
  if (!codexWeeklyCapsSession(secondary.remainingPercent, weeklyResetsAt, now)) {
    return sections;
  }

  const bindingResetsAt = codexBindingResetsAt(primary.remainingPercent, primary.resetsAt, weeklyResetsAt, now);
  const next = sections.slice();
  next[primaryIndex] = {
    ...primary,
    remainingPercent: 0,
    resetsIn: bindingResetsAt ? formatCountdown(bindingResetsAt, now) : undefined,
    usagePacing: undefined,
  };
  return next;
}

type CodexResetCredit = {
  expiresAt?: string;
  expiresAtMs?: number;
};

function normalizeCodexResetCredits(payload: RawProviderPayload, now: number): CodexResetCredit[] {
  const usage = toRecord(payload.usage);
  const codexResetCredits = toRecord(usage?.codexResetCredits);
  const credits = Array.isArray(codexResetCredits?.credits) ? codexResetCredits.credits : [];
  const availableCredits: CodexResetCredit[] = [];

  for (const credit of credits) {
    const record = toRecord(credit);
    if (!record || record.status !== "available") {
      continue;
    }

    const expiresAt = firstString(record.expires_at, record.expiresAt);
    if (!expiresAt) {
      availableCredits.push({});
      continue;
    }

    const expiresAtMs = Date.parse(expiresAt);
    if (Number.isNaN(expiresAtMs) || expiresAtMs <= now) {
      continue;
    }

    availableCredits.push({ expiresAt, expiresAtMs });
  }

  return availableCredits.sort((left, right) => {
    if (left.expiresAtMs === undefined && right.expiresAtMs === undefined) {
      return 0;
    }

    if (left.expiresAtMs === undefined) {
      return 1;
    }

    if (right.expiresAtMs === undefined) {
      return -1;
    }

    return left.expiresAtMs - right.expiresAtMs;
  });
}

function formatCodexResetCreditCount(count: number): string {
  return count === 1 ? "1 available" : `${count} available`;
}

function formatCodexResetCreditExpiry(credit: CodexResetCredit, now: number): string {
  return credit.expiresAt ? (formatCountdown(credit.expiresAt, now) ?? "No expiry") : "No expiry";
}

function buildCodexResetCreditSection(payload: RawProviderPayload, now: number): ProviderSection[] {
  const credits = normalizeCodexResetCredits(payload, now);
  if (credits.length === 0) {
    return [];
  }

  const items: ProviderSectionItem[] = [
    { label: "Available", value: formatCodexResetCreditCount(credits.length) },
    { label: "Next expiry", value: formatCodexResetCreditExpiry(credits[0], now) },
  ];

  if (credits.length > 1) {
    items.push({
      label: "Expiries",
      value: credits.map((credit) => formatCodexResetCreditExpiry(credit, now)).join(", "),
    });
  }

  return [
    {
      kind: "info",
      title: "Limit Reset Credits",
      items,
      usageItemId: "section:codex-reset-credits",
    },
  ];
}

function buildCodexCodeReviewSection(payload: RawProviderPayload, now: number): ProviderSection[] {
  const dashboard = toRecord(payload.openaiDashboard);
  const codeReviewRemainingPercent = toFiniteNumber(dashboard?.codeReviewRemainingPercent);
  if (codeReviewRemainingPercent === undefined) {
    return [];
  }

  const codeReviewResetsAt = toNonBlankString(toRecord(dashboard?.codeReviewLimit)?.resetsAt);
  return [
    {
      kind: "supplementalUsage",
      title: "Code review",
      remainingPercent: clampPercent(codeReviewRemainingPercent),
      resetsIn: codeReviewResetsAt ? formatCountdown(codeReviewResetsAt, now) : undefined,
      usageItemId: "metric:code-review",
    },
  ];
}

// Raw path only. Presentation meters already chose labels, remaining, and ids.
export const interpret: NonNullable<ProviderModule["interpret"]> = ({
  payload,
  sections,
  planText,
  hasPresentationMeters,
  now,
}) => {
  if (hasPresentationMeters) {
    return { sections, planText };
  }

  const capped = stampCodexLaneIds(applyCodexWeeklySessionCap(sections, now));
  const added = [...buildCodexCodeReviewSection(payload, now), ...buildCodexResetCreditSection(payload, now)];
  return {
    sections: added.length > 0 ? [...capped, ...added] : capped,
    planText,
  };
};
