import { useCachedPromise } from "@raycast/utils";
import { getCodexBarClientAvailability, type CodexBarClientAvailability } from "../services/codexbarClient";
import { getKeychainAccessPolicy } from "../preferences";

type UseCodexBarAvailabilityResult = {
  availability?: CodexBarClientAvailability;
  isLoading: boolean;
  error?: Error;
  revalidate: () => void;
};

export function useCodexBarAvailability(): UseCodexBarAvailabilityResult {
  const keychainAccessPolicy = getKeychainAccessPolicy();
  const { data, error, isLoading, revalidate } = useCachedPromise(
    getCodexBarClientAvailability,
    [keychainAccessPolicy],
    {
      // Never expose a client resolved under the previous policy while a
      // preference change is being revalidated.
      keepPreviousData: false,
    },
  );

  return {
    availability: data,
    isLoading,
    error,
    revalidate,
  };
}
