import { Color, Icon, type Image } from "@raycast/api";
import { PROVIDER_CATALOG, PROVIDER_ID_ALIASES, PROVIDER_MODULES } from "./index";
import type { ProviderModuleMap } from "./module";
import type { ProviderCatalogEntry, ProviderIconFallback, ProviderUsageSectionLabels } from "./types";

export type { ProviderUsageSectionLabels };

export type ProviderProgressPalette = {
  lightFill: string;
  darkFill: string;
};

export type ProviderRegistryEntry = {
  id: string;
  name: string;
  icon: Image.ImageLike;
  brandColor: string;
  progressPalette: ProviderProgressPalette;
  usageSectionLabels: ProviderUsageSectionLabels;
  dashboardUrl?: string;
  subscriptionDashboardUrl?: string;
  statusPageUrl?: string;
};

const DEFAULT_PROGRESS_PALETTE: ProviderProgressPalette = {
  lightFill: "#22B8CF",
  darkFill: "#22B8CF",
};

function providerIcon(slug: string, fallback: Icon = Icon.Circle): Image.ImageLike {
  return {
    source: `provider-icons/${slug}.svg`,
    fallback,
    tintColor: Color.PrimaryText,
  };
}

function iconFromFallback(name: ProviderIconFallback | undefined): Icon {
  if (!name) {
    return Icon.Circle;
  }

  const value = (Icon as unknown as Record<string, Icon | undefined>)[name];
  if (value === undefined) {
    throw new Error(`Unknown icon fallback "${name}"`);
  }

  return value;
}

export function resolveProviderId(id: string, modules: ProviderModuleMap = PROVIDER_MODULES): string {
  for (const [providerId, providerModule] of Object.entries(modules)) {
    if (providerModule.aliases?.includes(id)) {
      return providerId;
    }
  }
  return PROVIDER_ID_ALIASES[id] ?? id;
}

export const PROVIDER_IDS = Object.keys(PROVIDER_CATALOG) as Array<keyof typeof PROVIDER_CATALOG>;
export const PROVIDER_SELECTOR_IDS = ["all", "both"] as const;
const PROVIDER_SELECTOR_ID_SET = new Set<string>(PROVIDER_SELECTOR_IDS);

function normalizeHexColor(value: string): string {
  const normalized = value.trim().toUpperCase();
  return normalized.startsWith("#") ? normalized : `#${normalized}`;
}

function buildProgressPalette(brandColor: string): ProviderProgressPalette {
  const fill = normalizeHexColor(brandColor);
  return { lightFill: fill, darkFill: fill };
}

export function parseAccentColor(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  let text = value.trim();
  if (text.startsWith("#")) {
    text = text.slice(1);
  }
  if (!/^[0-9A-Fa-f]{6}$/.test(text)) {
    return undefined;
  }

  return `#${text.toUpperCase()}`;
}

function registryEntryFromCatalog(id: string, entry: ProviderCatalogEntry): ProviderRegistryEntry {
  const brandColor = normalizeHexColor(entry.brandColor);
  return {
    id,
    name: entry.name,
    icon: providerIcon(entry.iconSlug, iconFromFallback(entry.iconFallback)),
    brandColor,
    progressPalette: buildProgressPalette(brandColor),
    usageSectionLabels: entry.usageSectionLabels,
    dashboardUrl: entry.dashboardUrl,
    subscriptionDashboardUrl: entry.subscriptionDashboardUrl,
    statusPageUrl: entry.statusPageUrl,
  };
}

const PROVIDER_ENTRIES = PROVIDER_IDS.map((id) => registryEntryFromCatalog(id, PROVIDER_CATALOG[id]));

const PROVIDER_REGISTRY = new Map<string, ProviderRegistryEntry>(PROVIDER_ENTRIES.map((entry) => [entry.id, entry]));

function fallbackName(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isKnownProviderId(id: string): boolean {
  return PROVIDER_REGISTRY.has(resolveProviderId(id));
}

export function isProviderSelectorId(id: string): boolean {
  return PROVIDER_SELECTOR_ID_SET.has(id);
}

export function getProviderMetadata(id: string): ProviderRegistryEntry {
  const entry = PROVIDER_REGISTRY.get(resolveProviderId(id));
  if (entry) {
    return entry;
  }

  return {
    id,
    name: fallbackName(id),
    icon: Icon.Circle,
    brandColor: DEFAULT_PROGRESS_PALETTE.lightFill,
    progressPalette: DEFAULT_PROGRESS_PALETTE,
    usageSectionLabels: { primary: "Primary", secondary: "Secondary", tertiary: "Tertiary" },
  };
}

export function getProviderProgressPalette(id: string, accentColor?: string): ProviderProgressPalette {
  const override = parseAccentColor(accentColor);
  if (override) {
    return buildProgressPalette(override);
  }

  return getProviderMetadata(id).progressPalette;
}

// Picks the "Open Usage Dashboard" target.
export function resolveDashboardUrl(
  providerId: string,
  planText?: string,
  accountOrganization?: string,
  modules: ProviderModuleMap = PROVIDER_MODULES,
): string | undefined {
  const canonicalId = resolveProviderId(providerId, modules);
  const moduleDashboard = modules[canonicalId]?.dashboardUrl;
  if (moduleDashboard) {
    return moduleDashboard({ planText, accountOrganization });
  }
  const metadata = getProviderMetadata(canonicalId);
  // Other dual-URL providers have no plan detection, and the usage this extension meters
  // is their subscription usage — so the subscription dashboard is the better target when
  // upstream provides one. Deliberate divergence from upstream, which only plan-switches Claude.
  return metadata.subscriptionDashboardUrl ?? metadata.dashboardUrl;
}

export function getProviderUsageSectionDisplayTitle(providerId: string, sectionTitle: string): string {
  const labels = getProviderMetadata(providerId).usageSectionLabels;

  if (sectionTitle === "Primary") {
    return labels.primary;
  }

  if (sectionTitle === "Secondary") {
    return labels.secondary ?? sectionTitle;
  }

  if (sectionTitle === "Tertiary") {
    return labels.tertiary ?? sectionTitle;
  }

  return sectionTitle;
}
