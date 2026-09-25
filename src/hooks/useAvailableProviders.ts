import { useCachedPromise } from "@raycast/utils";
import type { CodexBarClient } from "../services/codexbarClient";
import type { AvailableProvider } from "../providers/types";

type UseAvailableProvidersResult = {
  providers: AvailableProvider[];
  isLoading: boolean;
  error?: Error;
  revalidate: () => Promise<void>;
};

export function useAvailableProviders(client?: CodexBarClient): UseAvailableProvidersResult {
  const { data, error, isLoading, revalidate } = useCachedPromise(
    async (resolvedClient?: CodexBarClient) => (resolvedClient ? resolvedClient.listAvailableProviders() : []),
    [client],
    {
      keepPreviousData: true,
    },
  );

  return {
    providers: data ?? [],
    isLoading,
    error,
    revalidate: async () => {
      await revalidate();
    },
  };
}
