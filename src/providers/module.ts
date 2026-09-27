import type { DynamicTitleFn, ExtraWindowPace, PaceCapability } from "./paceCapabilities";
import type { ProviderCatalogEntry } from "./types";
import type { ProviderSection, RawProviderPayload } from "../usage/types";

export type ProviderMock = {
  source?: string;
  windowCount?: 1 | 2;
  build?: (now: Date) => RawProviderPayload;
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
  extraWindowPace?: ExtraWindowPace;
  mock?: ProviderMock;
  displayTitle?: DynamicTitleFn;
  dashboardUrl?: (input: ProviderDashboardInput) => string | undefined;
  interpret?: (input: ProviderInterpretInput) => ProviderInterpretResult;
};

export type ProviderModuleMap = Readonly<Record<string, ProviderModule>>;

export function providerModuleById(id: string, modules: ProviderModuleMap): ProviderModule | undefined {
  if (!Object.hasOwn(modules, id)) return undefined;
  return modules[id];
}

export function assembleProviderCatalog<
  Order extends readonly string[],
  Modules extends Record<keyof Modules, ProviderModule>,
>(order: Order, modules: Modules): { [Id in Order[number]]: ProviderCatalogEntry } {
  const seen = new Set<string>();
  const catalog = {} as { [Id in Order[number]]: ProviderCatalogEntry };
  for (const id of order) {
    if (seen.has(id)) {
      throw new Error(`Duplicate catalog order id: ${id}`);
    }
    seen.add(id);
    if (!Object.hasOwn(modules, id)) {
      throw new Error(`Missing provider module for ${id}`);
    }
    catalog[id as Order[number]] = modules[id as keyof Modules].metadata;
  }
  for (const id of Object.keys(modules)) {
    if (!seen.has(id)) {
      throw new Error(`Provider module id missing from order: ${id}`);
    }
  }
  return catalog;
}

export function providerIdAliases(modules: ProviderModuleMap): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const [id, providerModule] of Object.entries(modules)) {
    for (const alias of providerModule.aliases ?? []) {
      if (Object.hasOwn(modules, alias)) {
        throw new Error(`Alias "${alias}" is a provider id`);
      }
      const existing = aliases[alias];
      if (existing !== undefined) {
        throw new Error(`Alias "${alias}" is shared by ${existing} and ${id}`);
      }
      aliases[alias] = id;
    }
  }
  return aliases;
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
