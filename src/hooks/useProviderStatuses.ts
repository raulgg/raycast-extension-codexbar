import { readProviderStatuses } from "../lib/providerStatusCache";
import type { ProviderStatus } from "../providers/types";

// Live read of background-warmed status cache. No memo: keeps badges fresh when cache updates.
export function useProviderStatuses(providerIds: string[]): Record<string, ProviderStatus> {
  return readProviderStatuses(providerIds);
}
