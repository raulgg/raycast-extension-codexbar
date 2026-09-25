import { useCachedPromise } from "@raycast/utils";
import type { CodexBarClient } from "../services/codexbarClient";
import type { ConfiguredProvider } from "../providers/types";

type UseUsageOverviewResult = {
  providers: ConfiguredProvider[];
  isLoading: boolean;
  error?: Error;
  revalidate: () => void;
};

export function useUsageOverview(client?: CodexBarClient): UseUsageOverviewResult {
  const { data, error, isLoading, revalidate } = useCachedPromise(
    async (resolvedClient?: CodexBarClient) => (resolvedClient ? resolvedClient.readConfiguredProviders() : []),
    [client],
    {
      keepPreviousData: true,
    },
  );

  return {
    providers: data ?? [],
    isLoading,
    error,
    revalidate,
  };
}
