import type { RawProviderPayload } from "../usage/types";

// Kept out of mockPayloads.ts so a provider mock.ts can import it.
// mockPayloads.ts loads the provider index, which loads each mock.ts.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

type MockWindow = {
  usedPercent: number;
  resetsAt: string | null;
  resetDescription: string | null;
  nextRegenPercent?: number;
  windowMinutes?: number;
};

type MockPayloadOptions = {
  source: string;
  version: string | null;
  status: Record<string, unknown> | null;
  usage: Record<string, unknown> | null;
  credits: Record<string, unknown> | null;
  antigravityPlanInfo: Record<string, unknown> | null;
  openaiDashboard: Record<string, unknown> | null;
};

export function iso(value: Date): string {
  return value.toISOString();
}

export function offsetIso(now: Date, offsetMs: number): string {
  return iso(new Date(now.getTime() + offsetMs));
}

export function buildWindow(
  now: Date,
  usedPercent: number,
  resetOffsetMs: number | null,
  resetDescription: string | null = null,
  nextRegenPercent?: number,
  windowMinutes?: number,
): MockWindow {
  return {
    usedPercent,
    resetsAt: resetOffsetMs === null ? null : offsetIso(now, resetOffsetMs),
    resetDescription,
    ...(nextRegenPercent === undefined ? {} : { nextRegenPercent }),
    ...(windowMinutes === undefined ? {} : { windowMinutes }),
  };
}

export function buildIdentity(
  providerID: string,
  email: string | null,
  organization: string | null,
  loginMethod: string | null,
): Record<string, unknown> {
  return {
    identity: {
      providerID,
      accountEmail: email,
      accountOrganization: organization,
      loginMethod,
    },
    accountEmail: email,
    accountOrganization: organization,
    loginMethod,
  };
}

export function buildPayload(provider: string, options: MockPayloadOptions): RawProviderPayload {
  return {
    provider,
    account: null,
    version: options.version,
    source: options.source,
    status: options.status,
    usage: options.usage,
    credits: options.credits,
    antigravityPlanInfo: options.antigravityPlanInfo,
    openaiDashboard: options.openaiDashboard,
    error: null,
  };
}

export function buildUsage(
  now: Date,
  primary: MockWindow | null,
  secondary: MockWindow | null = null,
  tertiary: MockWindow | null = null,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    primary,
    secondary,
    tertiary,
    updatedAt: iso(now),
    ...extras,
  };
}
