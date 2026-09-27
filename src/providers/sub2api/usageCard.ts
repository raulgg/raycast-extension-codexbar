import type { ProviderModule } from "../module";

export const displayTitle: NonNullable<ProviderModule["displayTitle"]> = (slotTitle, options) => {
  if (slotTitle === "Primary" && options.windows.Secondary.usedPercent !== undefined) {
    return "Daily quota";
  }

  return undefined;
};
