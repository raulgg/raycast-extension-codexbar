import type { ProviderModule } from "../module";

const MONTHLY_WINDOW_SENTINEL_MINUTES = 30 * 24 * 60;

export const displayTitle: NonNullable<ProviderModule["displayTitle"]> = (slotTitle, options) => {
  if (slotTitle === "Primary" && options.windows.Primary.windowMinutes === MONTHLY_WINDOW_SENTINEL_MINUTES) {
    return "Monthly";
  }

  return undefined;
};
