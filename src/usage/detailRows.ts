import { toRecord, toTrimmedString } from "./json";
import type { RawProviderPayload } from "./types";

export type UsageDetailRow = { value?: string; secondaryValue?: string };

// First row with this label in `usage.details[].rows`, like upstream UsageSnapshot.detailRow(label:).
export function usageDetailRow(payload: RawProviderPayload, label: string): UsageDetailRow | undefined {
  const usage = toRecord(payload.usage);
  if (!usage || !Array.isArray(usage.details)) {
    return undefined;
  }

  for (const section of usage.details) {
    const rows = toRecord(section)?.rows;
    if (!Array.isArray(rows)) {
      continue;
    }

    for (const row of rows) {
      const record = toRecord(row);
      if (toTrimmedString(record?.label) !== label) {
        continue;
      }
      return { value: scalarString(record?.value), secondaryValue: scalarString(record?.secondaryValue) };
    }
  }

  return undefined;
}

function scalarString(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return toTrimmedString(value);
}
