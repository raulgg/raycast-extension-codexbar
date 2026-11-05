import { usageDetailRow } from "../../usage/detailRows";
import type { RawProviderPayload } from "../../usage/types";

// Kiro menu-card copy from MenuCardView+ModelHelpers.swift and MenuCardView.swift.

const KIRO_OVERAGE_WINDOW_ID = "kiro-overage";

// Primary `.kiroCredits`: "X of Y credits left". A zero total is skipped.
export function kiroCreditsDetail(payload: RawProviderPayload): string | undefined {
  const remaining = usageDetailRow(payload, "Credits left")?.value;
  const total = usageDetailRow(payload, "Credits total")?.value;
  if (!remaining || !total || total === "0") {
    return undefined;
  }
  return `${remaining} of ${total} credits left`;
}

// Secondary: "X of Y bonus credits left". Y is the text before "·" on Bonus credits left, without "of ".
export function kiroBonusDetail(payload: RawProviderPayload): string | undefined {
  const row = usageDetailRow(payload, "Bonus credits left");
  const remaining = row?.value;
  const head = row?.secondaryValue?.split("·", 2)[0]?.trim();
  if (!remaining || !head) {
    return undefined;
  }
  const total = head.startsWith("of ") ? head.slice(3).trim() : head;
  if (!total) {
    return undefined;
  }
  return `${remaining} of ${total} bonus credits left`;
}

// kiroOverageRemainingDetail: only the kiro-overage extra window. It takes the left label of the
// shared line. The pace right label and marker stay.
export function kiroOverageDetail(payload: RawProviderPayload, windowId: string | undefined): string | undefined {
  if (windowId !== KIRO_OVERAGE_WINDOW_ID) {
    return undefined;
  }
  const remaining = usageDetailRow(payload, "Overage credits left")?.value;
  const capPhrase = usageDetailRow(payload, "Overage usage")?.secondaryValue;
  if (!remaining || !capPhrase?.startsWith("of ")) {
    return undefined;
  }
  const total = capPhrase.slice(3);
  if (!total) {
    return undefined;
  }
  return `${remaining} of ${total} credits left`;
}
