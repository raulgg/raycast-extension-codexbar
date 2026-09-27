import type { ProviderModule } from "../module";

function windowRenders(window: { usedPercent?: number }): boolean {
  return window.usedPercent !== undefined;
}

export const displayTitle: NonNullable<ProviderModule["displayTitle"]> = (slotTitle, options) => {
  if (!windowRenders(options.windows.Tertiary)) {
    return undefined;
  }

  return slotTitle === "Primary" ? "5-hour" : slotTitle === "Secondary" ? "Weekly" : "Monthly";
};
