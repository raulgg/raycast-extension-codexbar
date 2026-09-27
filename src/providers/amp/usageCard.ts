import type { ProviderModule } from "../module";

function windowRenders(window: { usedPercent?: number }): boolean {
  return window.usedPercent !== undefined;
}

export const displayTitle: NonNullable<ProviderModule["displayTitle"]> = (slotTitle, options) => {
  if (slotTitle === "Primary" && options.hasAgentDetailRow) {
    return "Agent usage";
  }

  if (!windowRenders(options.windows.Secondary)) {
    return undefined;
  }

  if (slotTitle === "Primary") {
    return "Other usage";
  }

  if (slotTitle === "Secondary") {
    return "Orb usage";
  }

  return undefined;
};
