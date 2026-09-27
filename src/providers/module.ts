import type { ProviderCatalogEntry } from "./catalog";
import { PROVIDER_MODULES } from "./index";
import type { DynamicTitleFn, PaceCapability } from "./paceCapabilities";
import type { ProviderSection, RawProviderPayload } from "../usage/types";

export type ProviderMock = {
  source?: string;
  windowCount?: 1 | 2;
};

export type ProviderDashboardInput = {
  planText?: string;
  accountOrganization?: string;
};

export type ProviderInterpretInput = {
  payload: RawProviderPayload;
  sections: ProviderSection[];
  planText?: string;
  hasPresentationMeters: boolean;
  now: number;
};

export type ProviderInterpretResult = {
  sections: ProviderSection[];
  planText?: string;
};

export type ProviderModule = {
  metadata: ProviderCatalogEntry;
  aliases?: readonly string[];
  pace?: PaceCapability;
  mock?: ProviderMock;
  displayTitle?: DynamicTitleFn;
  dashboardUrl?: (input: ProviderDashboardInput) => string | undefined;
  interpret?: (input: ProviderInterpretInput) => ProviderInterpretResult;
};

export type ProviderModuleMap = Readonly<Record<string, ProviderModule>>;

export function assertDistinctProviderModules<Modules extends Record<keyof Modules, ProviderModule>>(
  legacy: Readonly<Record<string, ProviderCatalogEntry>>,
  modules: Modules,
): void {
  const duplicates = Object.keys(modules).filter((id) => Object.prototype.hasOwnProperty.call(legacy, id));
  if (duplicates.length > 0) {
    throw new Error(`Provider modules duplicate legacy catalog ids: ${duplicates.join(", ")}`);
  }
}

export function providerModuleById(id: string): ProviderModule | undefined {
  if (!Object.hasOwn(PROVIDER_MODULES, id)) return undefined;
  return PROVIDER_MODULES[id as keyof typeof PROVIDER_MODULES];
}

export function providerModuleMetadata<Modules extends Record<keyof Modules, ProviderModule>>(
  modules: Modules,
): { [Id in keyof Modules]: ProviderCatalogEntry } {
  const metadata = {} as { [Id in keyof Modules]: ProviderCatalogEntry };
  for (const id of Object.keys(modules) as Array<keyof Modules & string>) {
    metadata[id] = modules[id].metadata;
  }
  return metadata;
}
