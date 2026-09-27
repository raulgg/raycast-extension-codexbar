import type { ProviderModule } from "../module";
import { grokPrimaryDisplayTitle, grokWindowDurationMs } from "./window";

export const displayTitle: NonNullable<ProviderModule["displayTitle"]> = (slotTitle, options) => {
  if (slotTitle !== "Primary") {
    return undefined;
  }

  const window = options.windows.Primary;
  const durationMs = grokWindowDurationMs(window.windowMinutes, window.resetsAt, options.now);
  const dynamicTitle = grokPrimaryDisplayTitle(durationMs);
  if (dynamicTitle) {
    return dynamicTitle;
  }

  if (window.windowMinutes === undefined && window.resetsAt) {
    return "Weekly";
  }

  return undefined;
};
