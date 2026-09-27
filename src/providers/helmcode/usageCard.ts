import type { ProviderModule } from "../module";

const NAN_BUILDERS_ORGANIZATION = "NaN Builders";
const NAN_BUILDERS_DASHBOARD_URL = "https://cloud.nan.builders/dashboard";

// HelmcodeProviderDescriptor.dashboardURL(snapshot:) switches host for NaN Builders.
// Returning undefined would drop the menu link, so every other account gets the catalog URL.
export function dashboardUrl(defaultDashboardUrl: string): NonNullable<ProviderModule["dashboardUrl"]> {
  return ({ accountOrganization }) =>
    accountOrganization === NAN_BUILDERS_ORGANIZATION ? NAN_BUILDERS_DASHBOARD_URL : defaultDashboardUrl;
}
