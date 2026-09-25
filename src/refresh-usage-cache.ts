import { refreshUsageCache } from "./services/backgroundRefresh";

export default async function Command() {
  await refreshUsageCache();
}
