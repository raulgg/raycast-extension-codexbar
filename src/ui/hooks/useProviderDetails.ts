import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { CodexBarClient } from "../../services/codexbarClient";
import { createProviderDetailStore } from "../../services/providerDetailStore";
import { getKeychainAccessPolicy } from "../../preferences";
import type { ConfiguredProvider } from "../../usage/types";
import type { ProviderDetailResults } from "../../cache/providerDetailCache";

export type {
  ProviderDetailCacheStatus,
  ProviderDetailResults,
  ProviderDetailState,
} from "../../cache/providerDetailCache";

type FetchProviderOptions = {
  force?: boolean;
};

type UseProviderDetailsResult = {
  results: ProviderDetailResults;
  isLoading: boolean;
  refreshProvider: (providerId: string, options?: FetchProviderOptions) => void;
};

// Thin React binding over ProviderDetailStore: the store owns scheduling,
// dedupe, and stale-result discard; this hook only feeds it the current
// client + provider list and subscribes to its snapshot.
export function useProviderDetails(
  client: CodexBarClient | undefined,
  providers: ConfiguredProvider[],
  selectedProviderId?: string,
): UseProviderDetailsResult {
  const [store] = useState(() => createProviderDetailStore());
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const providersKey = providers.map((provider) => `${provider.id}\0${provider.source ?? "auto"}`).join("\u0001");
  const keychainAccessPolicy = client?.binary.keychainAccessPolicy ?? getKeychainAccessPolicy();

  useEffect(() => {
    store.setContext({ client, providers, keychainAccessPolicy });
  }, [store, client, providersKey, keychainAccessPolicy]);

  useEffect(() => {
    if (selectedProviderId) {
      store.ensureFresh(selectedProviderId);
    }
  }, [store, client, selectedProviderId]);

  const refreshProvider = useCallback(
    (providerId: string, options?: FetchProviderOptions) => store.refresh(providerId, options),
    [store],
  );

  return { results: snapshot.results, isLoading: snapshot.isLoading, refreshProvider };
}
