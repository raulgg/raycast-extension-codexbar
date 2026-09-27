import type { ProviderModule } from "../module";

export const displayTitle: NonNullable<ProviderModule["displayTitle"]> = (slotTitle, options) => {
  const window = options.windows.Primary;
  if (
    slotTitle === "Primary" &&
    window.windowMinutes === undefined &&
    window.resetDescription?.toLowerCase().includes("request")
  ) {
    return "Requests";
  }

  return undefined;
};
