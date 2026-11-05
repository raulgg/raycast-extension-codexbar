import { firstString, toRecord } from "../../usage/json";
import type { RawProviderPayload } from "../../usage/types";

// Primary `.poeBalance` (poeBalanceDetailText): the text after "Balance:" on the login method.
export function poeBalanceDetail(payload: RawProviderPayload): string | undefined {
  const usage = toRecord(payload.usage);
  const identity = toRecord(payload.identity);
  const usageIdentity = toRecord(usage?.identity);
  const loginMethod = firstString(
    payload.loginMethod,
    identity?.loginMethod,
    usage?.loginMethod,
    usageIdentity?.loginMethod,
  );
  const prefix = "Balance:";
  if (!loginMethod?.startsWith(prefix)) {
    return undefined;
  }
  const balance = loginMethod.slice(prefix.length).trim();
  return balance || undefined;
}
