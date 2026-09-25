import { firstString, toRecord } from "../json";
import type { RawProviderPayload } from "../types";

// Claude reports its plan tier under several field names depending on the
// source; any of them wins over the generic loginMethod lookup.
export function extractClaudePlanText(payload: RawProviderPayload): string | undefined {
  const usage = toRecord(payload.usage);
  const usageIdentity = toRecord(usage?.identity);
  const identity = toRecord(payload.identity);
  const account = toRecord(payload.account);

  return firstString(
    payload.plan,
    identity?.plan,
    usage?.plan,
    usageIdentity?.plan,
    account?.plan,
    payload.subscriptionType,
    identity?.subscriptionType,
    usage?.subscriptionType,
    usageIdentity?.subscriptionType,
    account?.subscriptionType,
    payload.rateLimitTier,
    identity?.rateLimitTier,
    usage?.rateLimitTier,
    usageIdentity?.rateLimitTier,
    account?.rateLimitTier,
  );
}
