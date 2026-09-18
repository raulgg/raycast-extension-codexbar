import { clampPercent, toFiniteNumber, toRecord } from "../json";
import type { ProviderSection, ProviderSectionItem, RawProviderPayload } from "../types";

// Supplemental usage shapes keyed by their `usage.<field>` name (upstream-parity
// surface 5). Only OpenRouter is mapped today; add a field here when its live
// JSON has been sampled, never from a guess.

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

function formatCurrency(value: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    return `${formatNumber(value)} ${currencyCode}`;
  }
}

export const SUPPLEMENTAL_USAGE_MAPPERS: Record<
  string,
  (record: RawProviderPayload, now: number) => ProviderSection[]
> = {
  openRouterUsage: (record) => {
    const sections: ProviderSection[] = [];
    const usedPercent = toFiniteNumber(record.usedPercent);
    if (usedPercent !== undefined) {
      sections.push({
        kind: "supplementalUsage",
        title: "Credits used",
        remainingPercent: clampPercent(100 - usedPercent),
      });
    }

    const items: ProviderSectionItem[] = [];
    const balance = toFiniteNumber(record.balance);
    if (balance !== undefined) {
      items.push({ label: "Balance", value: formatCurrency(balance, "USD") });
    }

    const keyUsage = toFiniteNumber(record.keyUsage);
    const keyLimit = toFiniteNumber(record.keyLimit);
    if (keyUsage !== undefined && keyLimit !== undefined && keyLimit > 0) {
      items.push({
        label: "Key usage",
        value: `${formatCurrency(keyUsage, "USD")} / ${formatCurrency(keyLimit, "USD")}`,
      });
    }

    if (items.length > 0) {
      sections.push({ kind: "info", title: "OpenRouter", items });
    }

    return sections;
  },
};

export function buildSupplementalMapperSections(payload: RawProviderPayload, now = Date.now()): ProviderSection[] {
  const usage = toRecord(payload.usage);
  if (!usage) {
    return [];
  }

  const sections: ProviderSection[] = [];
  for (const [fieldName, mapper] of Object.entries(SUPPLEMENTAL_USAGE_MAPPERS)) {
    const record = toRecord(usage[fieldName]);
    if (record) {
      sections.push(...mapper(record, now));
    }
  }

  return sections;
}
