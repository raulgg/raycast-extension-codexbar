const WEEKLY_PACE_DEFAULT_WINDOW_MINUTES = 10_080;

export function grokWindowDurationMs(
  windowMinutes: number | undefined,
  resetsAt: string | undefined,
  now: number,
): number {
  if (windowMinutes !== undefined) {
    return windowMinutes * 60 * 1000;
  }

  if (resetsAt) {
    return Date.parse(resetsAt) - now;
  }

  return Number.NaN;
}

// Mirrors GrokProviderDescriptor.primaryLabel(duration:).
export function grokPrimaryDisplayTitle(durationMs: number): string | undefined {
  if (!Number.isFinite(durationMs) || durationMs <= 60 * 60 * 1000) {
    return undefined;
  }

  const days = Math.round(durationMs / (24 * 60 * 60 * 1000));
  if (days >= 4 && days <= 12) {
    return "Weekly";
  }

  if (days >= 20 && days <= 45) {
    return "Monthly";
  }

  return undefined;
}

export function grokWeeklyCredits(
  window: { windowMinutes?: number; resetsAt?: string; resetDescription?: string },
  now: number,
): boolean {
  if (!window.resetsAt) {
    return false;
  }

  if (grokPrimaryDisplayTitle(grokWindowDurationMs(window.windowMinutes, window.resetsAt, now)) !== "Weekly") {
    return false;
  }

  const resetAtMs = Date.parse(window.resetsAt);
  if (Number.isNaN(resetAtMs)) {
    return false;
  }

  const windowMinutes = window.windowMinutes ?? WEEKLY_PACE_DEFAULT_WINDOW_MINUTES;
  const timeUntilResetSeconds = (resetAtMs - now) / 1000;
  return windowMinutes > 0 && timeUntilResetSeconds > 0 && timeUntilResetSeconds <= windowMinutes * 60;
}
