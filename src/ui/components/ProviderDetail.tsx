import { environment, List } from "@raycast/api";
import { buildProviderErrorMarkdown } from "../../render/errorCard";
import { formatRelativeUpdateTime } from "../../render/format";
import type { ProviderDetailCacheStatus } from "../../cache/providerDetailCache";
import { getHidePersonalInfoPreference } from "../../preferences";
import { buildProviderDetailMarkdown, buildProviderLoadingMarkdown } from "../../render/detailCard";
import type { ConfiguredProvider, ProviderDetailData, ProviderStatus } from "../../usage/types";

type ProviderDetailProps = {
  provider: ConfiguredProvider;
  detail?: ProviderDetailData;
  error?: Error;
  isLoading: boolean;
  cacheStatus?: ProviderDetailCacheStatus;
  status?: ProviderStatus;
  relativeTimeNow?: number;
};

export function ProviderDetail({
  provider,
  detail,
  error,
  isLoading,
  cacheStatus,
  status,
  relativeTimeNow,
}: ProviderDetailProps) {
  const hidePersonalInfo = getHidePersonalInfoPreference();
  const detailMarkdown = detail
    ? buildProviderDetailMarkdown(hidePersonalInfo ? redactPersonalInfo(detail) : detail, environment.appearance, {
        subtitle: buildDetailSubtitle(detail, isLoading, cacheStatus, relativeTimeNow),
        now: relativeTimeNow,
        status,
        accentColor: provider.accentColor,
        hiddenUsageItemIDs: provider.hiddenUsageItemIDs,
      }).trim()
    : undefined;
  const markdown =
    detailMarkdown ??
    (error
      ? buildProviderErrorMarkdown(provider.name, error, environment.appearance)
      : isLoading
        ? buildProviderLoadingMarkdown(provider, environment.appearance)
        : "No data available");

  return <List.Item.Detail isLoading={isLoading} markdown={markdown} />;
}

// The account email is the only personal field the detail card still renders
// (account label and organization went with the removed General section).
function redactPersonalInfo(detail: ProviderDetailData): ProviderDetailData {
  return { ...detail, accountEmail: undefined };
}

function buildDetailSubtitle(
  detail: ProviderDetailData,
  isLoading: boolean,
  cacheStatus?: ProviderDetailCacheStatus,
  now?: number,
): string | undefined {
  if (cacheStatus === "stale") {
    if (isLoading) return "Updating... | ⚠︎ Stale data";
    const relativeUpdatedAt = formatRelativeUpdateTime(getProviderDetailHeaderTimestamp(detail, cacheStatus), { now });
    return relativeUpdatedAt ? `Updated ${relativeUpdatedAt} | ⚠︎ Stale data` : "⚠︎ Stale data";
  }
  return isLoading ? "Updating..." : undefined;
}

export function getProviderDetailHeaderTimestamp(
  detail: Pick<ProviderDetailData, "fetchedAt" | "updatedAt"> | undefined,
  cacheStatus?: ProviderDetailCacheStatus,
): string | undefined {
  if (!detail) {
    return undefined;
  }

  return cacheStatus === "stale" ? detail.fetchedAt : detail.updatedAt;
}
