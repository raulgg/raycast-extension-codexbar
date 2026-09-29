import type { ProviderUsagePacingContext } from "../usage/types";
import { PROVIDER_CATALOG, PROVIDER_ID_ALIASES } from "./index";
import type { ProviderModuleMap } from "./module";

export const SESSION_PACE_DEFAULT_WINDOW_MINUTES = 300;
export const WEEKLY_PACE_DEFAULT_WINDOW_MINUTES = 10_080;
export const MONTHLY_WINDOW_SENTINEL_MINUTES = 30 * 24 * 60;

export type PacePredicateId =
  "ampRenewsInDescription" | "codexSessionRejectsWeeklyMonthly" | "grokWeeklyCredits" | "zaiMonthlyMcp";

export type PaceWindow = {
  windowMinutes?: number;
  resetsAt?: string;
  resetDescription?: string;
};

export type PacePredicate = (window: PaceWindow, now: number) => boolean;

export type PacePredicateRule = {
  type: "predicate";
  id: PacePredicateId;
  matches: PacePredicate;
};

export type PaceWindowRule =
  | { type: "unsupported" }
  | { type: "always" }
  | { type: "resetDatePresent" }
  | { type: "windowDurationPresent" }
  | { type: "windowDuration"; minutes: number }
  | { type: "windowDurationAtMost"; minutes: number }
  | PacePredicateRule;

export type PaceDurationRule =
  | { type: "unsupported" }
  | { type: "windowDurationMissing" }
  | { type: "windowDuration"; minutes: number }
  | PacePredicateRule;

export type PaceCapability = {
  resetWindowPace: PaceWindowRule;
  inferredMonthlyDuration: PaceDurationRule;
  sessionPaceWindowRule: PaceWindowRule;
  secondarySessionPace?: boolean;
  secondaryAllowsDefaultWindow?: boolean;
  // Swift default is true. OpenCode Go sets false so estimated local costs do not pace.
  allowsEstimatedUsage?: boolean;
};

export type SlotTitle = "Primary" | "Secondary" | "Tertiary";

export type ResolvedSlotPace = {
  context: ProviderUsagePacingContext;
  defaultWindowMinutes: number;
  windowMinutes?: number;
};

const UNSUPPORTED: PaceCapability = {
  resetWindowPace: { type: "unsupported" },
  inferredMonthlyDuration: { type: "unsupported" },
  sessionPaceWindowRule: { type: "unsupported" },
};

function matchWindowRule(rule: PaceWindowRule, window: PaceWindow, now: number): boolean {
  switch (rule.type) {
    case "unsupported":
      return false;
    case "always":
      return true;
    case "resetDatePresent":
      return window.resetsAt !== undefined;
    case "windowDurationPresent":
      return window.windowMinutes !== undefined;
    case "windowDuration":
      return window.windowMinutes === rule.minutes;
    case "windowDurationAtMost":
      return window.windowMinutes !== undefined && window.windowMinutes <= rule.minutes;
    case "predicate":
      return rule.matches(window, now);
  }
}

function matchDurationRule(rule: PaceDurationRule, window: PaceWindow, now: number): boolean {
  switch (rule.type) {
    case "unsupported":
      return false;
    case "windowDurationMissing":
      return window.windowMinutes === undefined;
    case "windowDuration":
      return window.windowMinutes === rule.minutes;
    case "predicate":
      return rule.matches(window, now);
  }
}

function addUtcMonths(date: Date, delta: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + delta;
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(day, lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

export function inferredMonthlyWindowMinutes(resetsAt: string): number | undefined {
  const endMs = Date.parse(resetsAt);
  if (Number.isNaN(endMs)) {
    return undefined;
  }

  const end = new Date(endMs);
  const start = addUtcMonths(end, -1);
  const minutes = (endMs - start.getTime()) / 60_000;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return undefined;
  }

  return Math.round(minutes);
}

function resolveResetWindow(capability: PaceCapability, window: PaceWindow): PaceWindow {
  if (!matchDurationRule(capability.inferredMonthlyDuration, window, 0) || !window.resetsAt) {
    return window;
  }

  const minutes = inferredMonthlyWindowMinutes(window.resetsAt);
  if (minutes === undefined) {
    return window;
  }

  return { ...window, windowMinutes: minutes };
}

export function getPaceCapability(providerId: string, modules: ProviderModuleMap): PaceCapability {
  return modules[providerId]?.pace ?? PACE_CAPABILITIES[providerId] ?? UNSUPPORTED;
}

// True when this window is the reset-window forecast, not the generic weekly fallback.
export function matchesResetWindowPace(
  providerId: string,
  window: PaceWindow,
  now: number,
  modules: ProviderModuleMap,
): boolean {
  return matchWindowRule(getPaceCapability(providerId, modules).resetWindowPace, window, now);
}

function isKnownProviderId(providerId: string, modules: ProviderModuleMap): boolean {
  for (const [id, providerModule] of Object.entries(modules)) {
    if (id === providerId || providerModule.aliases?.includes(providerId)) {
      return Object.hasOwn(PROVIDER_CATALOG, id);
    }
  }
  const canonical = PROVIDER_ID_ALIASES[providerId] ?? providerId;
  return Object.hasOwn(PROVIDER_CATALOG, canonical);
}

export function resolveSlotPace(
  providerId: string,
  slot: SlotTitle,
  window: PaceWindow,
  now: number,
  modules: ProviderModuleMap,
): ResolvedSlotPace | undefined {
  if (modules[providerId] === undefined && !isKnownProviderId(providerId, modules)) {
    return undefined;
  }

  const capability = getPaceCapability(providerId, modules);
  const resetPace = (): ResolvedSlotPace | undefined => {
    if (!matchWindowRule(capability.resetWindowPace, window, now)) {
      return undefined;
    }

    const resolved = resolveResetWindow(capability, window);
    return {
      context: "window",
      defaultWindowMinutes: WEEKLY_PACE_DEFAULT_WINDOW_MINUTES,
      windowMinutes: resolved.windowMinutes,
    };
  };
  const sessionPace = (): ResolvedSlotPace | undefined => {
    if (!matchWindowRule(capability.sessionPaceWindowRule, window, now)) {
      return undefined;
    }

    return {
      context: "session",
      defaultWindowMinutes: SESSION_PACE_DEFAULT_WINDOW_MINUTES,
      windowMinutes: window.windowMinutes,
    };
  };

  if (slot === "Tertiary") {
    return resetPace();
  }

  if (slot === "Primary" || (slot === "Secondary" && capability.secondarySessionPace)) {
    return resetPace() ?? sessionPace();
  }

  const reset = resetPace();
  if (reset) {
    return reset;
  }

  if (window.windowMinutes === undefined && !capability.secondaryAllowsDefaultWindow) {
    return undefined;
  }

  return {
    context: "window",
    defaultWindowMinutes: WEEKLY_PACE_DEFAULT_WINDOW_MINUTES,
    windowMinutes: window.windowMinutes,
  };
}

// MenuCardView+ModelHelpers.extraRateWindowPaceDetail.
export type ExtraWindowPace = "session-or-weekly" | "weekly-only";

export const EXTRA_WINDOW_PACE_PROVIDER_IDS = new Set<string>();
const WEEKLY_ONLY_EXTRA_WINDOW_PROVIDER_IDS = new Set<string>();

export function resolveExtraWindowPace(
  providerId: string,
  window: PaceWindow,
  modules: ProviderModuleMap,
): ResolvedSlotPace | undefined {
  const fromModule = modules[providerId]?.extraWindowPace;
  const fromLegacy = EXTRA_WINDOW_PACE_PROVIDER_IDS.has(providerId)
    ? WEEKLY_ONLY_EXTRA_WINDOW_PROVIDER_IDS.has(providerId)
      ? "weekly-only"
      : "session-or-weekly"
    : undefined;
  const pace = fromModule ?? fromLegacy;
  if (!pace) {
    return undefined;
  }

  if (pace === "weekly-only" && window.windowMinutes !== WEEKLY_PACE_DEFAULT_WINDOW_MINUTES) {
    return undefined;
  }

  if (window.windowMinutes === SESSION_PACE_DEFAULT_WINDOW_MINUTES) {
    return {
      context: "session",
      defaultWindowMinutes: SESSION_PACE_DEFAULT_WINDOW_MINUTES,
      windowMinutes: window.windowMinutes,
    };
  }

  if (window.windowMinutes === WEEKLY_PACE_DEFAULT_WINDOW_MINUTES) {
    return {
      context: "window",
      defaultWindowMinutes: WEEKLY_PACE_DEFAULT_WINDOW_MINUTES,
      windowMinutes: window.windowMinutes,
    };
  }

  return undefined;
}

export const PACE_CAPABILITIES: Record<string, PaceCapability> = {};

export type DynamicWindow = {
  // Swift `snapshot.* != nil`, before a missing record is replaced with {}.
  present: boolean;
  // Finite usedPercent. Factory, Amp, and sub2api relabel from this, not `present`.
  usedPercent?: number;
  windowMinutes?: number;
  resetsAt?: string;
  resetDescription?: string;
};

export type DynamicTitleOptions = {
  windows: Record<SlotTitle, DynamicWindow>;
  hasAgentDetailRow: boolean;
  now: number;
};

export type DynamicTitleFn = (slotTitle: SlotTitle, options: DynamicTitleOptions) => string | undefined;

export const DYNAMIC_SLOT_TITLES: Record<string, DynamicTitleFn> = {};

// Hand-edited list. upstream:prune removes an id only when CodexBar no longer ships that Provider.
export const UNPORTABLE_DYNAMIC_TITLES: Record<string, { reason: string }> = {
  cursor: { reason: "needs snapshot.detailRow Request quota" },
};

export function resolveDynamicSlotTitle(
  providerId: string,
  slotTitle: SlotTitle,
  options: DynamicTitleOptions,
  modules: ProviderModuleMap,
): string | undefined {
  const displayTitle = modules[providerId]?.displayTitle;
  if (displayTitle) {
    return displayTitle(slotTitle, options);
  }
  return DYNAMIC_SLOT_TITLES[providerId]?.(slotTitle, options);
}
