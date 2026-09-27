import type { ProviderModule } from "../module";

export const displayTitle: NonNullable<ProviderModule["displayTitle"]> = (slotTitle, options) => {
  if (slotTitle === "Primary" && options.windows.Primary.present && !options.windows.Secondary.present) {
    return "Credit";
  }

  return undefined;
};
