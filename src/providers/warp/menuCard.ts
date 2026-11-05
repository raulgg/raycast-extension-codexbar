// MenuCardView.secondaryMetric: when Warp's secondary resetDescription is non-empty, the card shows
// it as the detail line and drops that window's countdown. A date on the window does not keep it.
export function warpSecondaryClearsCountdown(providerId: string, resetDescription: string | undefined): boolean {
  return providerId === "warp" && Boolean(resetDescription?.trim());
}
