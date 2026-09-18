// Compact duration text shared by the reset countdown ("Resets in 2h 5m") and
// the pacing run-out ETA ("Runs out in 3d 4h"). Both round up to whole minutes
// and read `Xm` / `Xh Ym` / `Xd Yh`; they differ only in how they decide when
// to switch to days, which each entry point keeps.

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MINUTES_PER_DAY = 24 * 60;

function formatWholeMinutes(totalMinutes: number, unit: "hours" | "days"): string {
  if (unit === "hours") {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) {
      return `${minutes}m`;
    }

    if (minutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${minutes}m`;
  }

  const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / 60);
  if (hours === 0) {
    return `${days}d`;
  }

  return `${days}d ${hours}h`;
}

/**
 * Countdown to an ISO timestamp, or `undefined` once it has passed. Stays in
 * hours while the real remaining time is under a day, even when minute
 * rounding reaches exactly 24h.
 */
export function formatCountdown(isoTimestamp: string, now = Date.now()): string | undefined {
  const target = Date.parse(isoTimestamp);
  if (Number.isNaN(target)) {
    return undefined;
  }

  const diffMs = target - now;
  if (diffMs <= 0) {
    return undefined;
  }

  const totalMinutes = Math.ceil(diffMs / MINUTE_MS);
  return formatWholeMinutes(totalMinutes, diffMs < DAY_MS ? "hours" : "days");
}

/**
 * Duration in seconds as ETA text, `"now"` when nothing remains. Switches to
 * days once the rounded minute count reaches a full day.
 */
export function formatDurationSeconds(totalSeconds: number): string {
  const roundedMinutes = Math.max(0, Math.ceil(totalSeconds / 60));
  if (roundedMinutes <= 0) {
    return "now";
  }

  return formatWholeMinutes(roundedMinutes, roundedMinutes < MINUTES_PER_DAY ? "hours" : "days");
}
