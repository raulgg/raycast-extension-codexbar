import { showToast, Toast } from "@raycast/api";
import { useCallback, useRef } from "react";
import type { ProviderMoveDirection } from "../lib/providerConfig";
import type { CodexBarClient } from "../services/codexbarClient";

// Serializes config writes via busyRef so concurrent toggles/reorders don't clobber.
export function useMoveProvider(
  client: CodexBarClient | undefined,
  onMoved: (providerId: string) => void,
  busyRef?: { current: boolean },
): (providerId: string, direction: ProviderMoveDirection) => Promise<void> {
  const internalBusyRef = useRef(false);
  const activeBusyRef = busyRef ?? internalBusyRef;

  return useCallback(
    async (providerId: string, direction: ProviderMoveDirection) => {
      if (!client || activeBusyRef.current) {
        return;
      }
      activeBusyRef.current = true;

      try {
        const didMove = await client.moveConfiguredProvider(providerId, direction);
        if (!didMove) {
          return;
        }

        onMoved(providerId);
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to Reorder Providers",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        activeBusyRef.current = false;
      }
    },
    [client, onMoved, activeBusyRef],
  );
}
