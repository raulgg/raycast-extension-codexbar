import { Action, Icon } from "@raycast/api";
import type { CodexBarClient } from "../services/codexbarClient";
import { ManageProviders } from "./ManageProviders";

type ManageProvidersActionProps = {
  client?: CodexBarClient;
  onProvidersChanged?: () => void;
};

export function ManageProvidersAction({ client, onProvidersChanged }: ManageProvidersActionProps) {
  if (!client) {
    return null;
  }

  return (
    <Action.Push
      title="Manage Providers"
      icon={Icon.Cog}
      shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
      target={<ManageProviders client={client} onProvidersChanged={onProvidersChanged} />}
    />
  );
}
