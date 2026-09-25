import { getPreferenceValues } from "@raycast/api";
import type { KeychainAccessPolicy } from "./cli/keychainAccessPolicy";

// Mirrors the `preferences` entries in package.json. Declared here rather than
// relying on the `Preferences` global from the generated raycast-env.d.ts so
// `npm run typecheck` works in a fresh checkout before any `ray build`.
type ExtensionPreferences = {
  hidePersonalInfo?: boolean;
  disableKeychainAccess?: boolean;
};

export function getHidePersonalInfoPreference(): boolean {
  return getPreferenceValues<ExtensionPreferences>().hidePersonalInfo ?? false;
}

export function getKeychainAccessPolicy(): KeychainAccessPolicy {
  return getPreferenceValues<ExtensionPreferences>().disableKeychainAccess ? "disabled" : "default";
}
