export const CODEXBAR_DISABLE_KEYCHAIN_ACCESS_ENV = "CODEXBAR_DISABLE_KEYCHAIN_ACCESS";

export type KeychainAccessPolicy = "default" | "disabled";

// Every policy value, for caches that keep one entry per policy (ADR-0009).
export const KEYCHAIN_ACCESS_POLICIES: readonly KeychainAccessPolicy[] = ["default", "disabled"];

export function applyKeychainAccessPolicy(
  environment: NodeJS.ProcessEnv,
  policy: KeychainAccessPolicy,
): NodeJS.ProcessEnv {
  const childEnvironment = { ...environment };

  if (policy === "disabled") {
    childEnvironment[CODEXBAR_DISABLE_KEYCHAIN_ACCESS_ENV] = "1";
  } else {
    delete childEnvironment[CODEXBAR_DISABLE_KEYCHAIN_ACCESS_ENV];
  }

  return childEnvironment;
}
