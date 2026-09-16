// Kilo's plan text reads "<pass> · <detail> · …"; the pass name is the first
// segment unless the string is only an auto top-up notice.
export function extractKiloPass(rawPlanText: string): string | undefined {
  const parts = rawPlanText
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return undefined;
  }

  const firstPart = parts[0];
  if (firstPart.toLowerCase().startsWith("auto top-up:")) {
    return undefined;
  }

  return firstPart;
}
