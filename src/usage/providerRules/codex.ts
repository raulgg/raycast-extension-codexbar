import { formatCountdown } from "../duration";
import { clampPercent, firstString, toFiniteNumber, toNonBlankString, toRecord } from "../json";
import type { ProviderSection, ProviderSectionItem, RawProviderPayload } from "../types";

// Codex-only interpretation rules, ported from the CodexBar app. The weekly
// cap applies on the raw slot path (presentation meters never call it); the
// two info builders read OpenAI dashboard fields the CLI reports only for Codex.

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

export function applyCodexWeeklySessionCap(
  sections: ProviderSection[],
  resetsAtByTitle: Partial<Record<"Primary" | "Secondary", string | undefined>>,
  now: number,
): ProviderSection[] {
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

  const weeklyResetsAt = resetsAtByTitle.Secondary;
  if (!codexWeeklyCapsSession(secondary.remainingPercent, weeklyResetsAt, now)) {
    return sections;
  }

  const bindingResetsAt = codexBindingResetsAt(primary.remainingPercent, resetsAtByTitle.Primary, weeklyResetsAt, now);

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

function normalizeCodexResetCredits(payload: RawProviderPayload, now = Date.now()): CodexResetCredit[] {
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

export function buildCodexResetCreditSection(
  providerId: string,
  payload: RawProviderPayload,
  now = Date.now(),
): ProviderSection[] {
  if (providerId !== "codex") {
    return [];
  }

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

export function buildCodexCodeReviewSection(payload: RawProviderPayload, now = Date.now()): ProviderSection[] {
  const dashboard = toRecord(payload.openaiDashboard);
  const sections: ProviderSection[] = [];

  const codeReviewRemainingPercent = toFiniteNumber(dashboard?.codeReviewRemainingPercent);
  if (codeReviewRemainingPercent !== undefined) {
    const codeReviewResetsAt = toNonBlankString(toRecord(dashboard?.codeReviewLimit)?.resetsAt);
    sections.push({
      kind: "supplementalUsage",
      title: "Code review",
      remainingPercent: clampPercent(codeReviewRemainingPercent),
      resetsIn: codeReviewResetsAt ? formatCountdown(codeReviewResetsAt, now) : undefined,
      usageItemId: "metric:code-review",
    });
  }

  return sections;
}
