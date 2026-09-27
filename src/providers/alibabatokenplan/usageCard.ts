import type { ProviderModule } from "../module";

export const displayTitle: NonNullable<ProviderModule["displayTitle"]> = (slotTitle, options) => {
  const windowMinutes = options.windows[slotTitle].windowMinutes;
  if (slotTitle === "Primary" && windowMinutes === 5 * 60) {
    return "5-hour";
  }

  if (slotTitle === "Secondary" && windowMinutes === 7 * 24 * 60) {
    return "7-day";
  }

  return undefined;
};
