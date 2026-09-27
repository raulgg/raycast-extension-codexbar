import { clampPercent, toFiniteNumber, toRecord } from "../../usage/json";
import type { ProviderSection, ProviderSectionItem, RawProviderPayload } from "../../usage/types";
import type { ProviderModule } from "../module";

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

function openRouterCreditSections(payload: RawProviderPayload): ProviderSection[] {
  const record = toRecord(toRecord(payload.usage)?.openRouterUsage);
  if (!record) {
    return [];
  }

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
}

// Credit lines come from usage.openRouterUsage on the raw path. Presentation meters
// already replaced that path, so they stay as built.
export const interpret: NonNullable<ProviderModule["interpret"]> = ({
  payload,
  sections,
  planText,
  hasPresentationMeters,
}) => {
  if (hasPresentationMeters) {
    return { sections, planText };
  }

  const credits = openRouterCreditSections(payload);
  return {
    sections: credits.length > 0 ? [...sections, ...credits] : sections,
    planText,
  };
};
