// Coercion helpers for the loosely-typed JSON the CodexBar CLI emits. Every
// reader of a raw payload goes through these so "present but wrong type" and
// "absent" collapse to `undefined` in one place.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

/** A non-blank string, returned untrimmed. */
export function toNonBlankString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/** A non-blank string, trimmed. */
export function toTrimmedString(value: unknown): string | undefined {
  return toNonBlankString(value)?.trim();
}

/** The first non-blank string among the candidates, trimmed. */
export function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const stringValue = toTrimmedString(value);
    if (stringValue) {
      return stringValue;
    }
  }

  return undefined;
}

export function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}
