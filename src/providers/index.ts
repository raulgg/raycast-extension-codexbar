import type { ProviderModule } from "./module";
import zoommate from "./zoommate";

export const PROVIDER_MODULES = {
  zoommate,
} satisfies Record<string, ProviderModule>;
