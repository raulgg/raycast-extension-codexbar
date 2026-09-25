import { useMemo } from "react";
import { useCachedPromise } from "@raycast/utils";
import {
  hydrateCodexBarClientAvailability,
  loadCodexBarAvailabilitySnapshot,
  type CodexBarClientAvailability,
} from "../../services/codexbarClient";
import { getKeychainAccessPolicy } from "../../preferences";

type UseCodexBarAvailabilityResult = {
  availability?: CodexBarClientAvailability;
  isLoading: boolean;
  error?: Error;
  revalidate: () => void;
};

export function useCodexBarAvailability(): UseCodexBarAvailabilityResult {
  const keychainAccessPolicy = getKeychainAccessPolicy();
  const { data, error, isLoading, revalidate } = useCachedPromise(
    loadCodexBarAvailabilitySnapshot,
    [keychainAccessPolicy],
    {
      // Never expose a client resolved under the previous policy while a
      // preference change is being revalidated.
      keepPreviousData: false,
    },
  );
  const availability = useMemo(
    () => (data === undefined ? undefined : hydrateCodexBarClientAvailability(data)),
    [data],
  );

  return {
    availability,
    isLoading,
    error,
    revalidate,
  };
}
