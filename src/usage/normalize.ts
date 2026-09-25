import {
  getPaceCapability,
  resolveDynamicSlotTitle,
  resolveExtraWindowPace,
  resolveSlotPace,
  type DynamicWindow,
  type SlotTitle,
} from "../providers/paceCapabilities";
import { getProviderMetadata, getProviderUsageSectionDisplayTitle } from "../providers/registry";
import { calculateUsagePacing } from "./pacing";
import { parseProviderStatus } from "./status";
import { formatCountdown } from "./duration";
import { extractAccountEmail, extractAccountOrganization, formatPlanText } from "./identity";
import { clampPercent, isRecord, toFiniteNumber, toNonBlankString, toRecord, toTrimmedString } from "./json";
import { applyAntigravityDetailRules } from "./providerRules/antigravity";
import {
  applyCodexWeeklySessionCap,
  buildCodexCodeReviewSection,
  buildCodexResetCreditSection,
} from "./providerRules/codex";
import { buildSupplementalMapperSections } from "./providerRules/openrouter";
import { usageItemIdForSlot, usageItemIdFromMeterId } from "./usageItemVisibility";
import type {
  ProviderDetailData,
  ProviderSection,
  ProviderStatus,
  ProviderSupplementalUsageSection,
  ProviderUsagePacing,
  ProviderUsageSection,
  RawProviderPayload,
} from "./types";

type ProviderCandidate = {
  id?: string;
  payload: RawProviderPayload;
};

function extractDataConfidence(payload: RawProviderPayload): string | undefined {
  const usage = toRecord(payload.usage);
  return toTrimmedString(usage?.dataConfidence) ?? toTrimmedString(payload.dataConfidence);
}

function allowsUsagePacing(providerId: string, payload: RawProviderPayload): boolean {
  if (getPaceCapability(providerId).allowsEstimatedUsage !== false) {
    return true;
  }

  return extractDataConfidence(payload) !== "estimated";
}

function usageHasDetailRow(usage: RawProviderPayload | undefined, label: string): boolean {
  if (!usage || !Array.isArray(usage.details)) {
    return false;
  }

  for (const section of usage.details) {
    const rows = toRecord(section)?.rows;
    if (!Array.isArray(rows)) {
      continue;
    }

    for (const row of rows) {
      if (toTrimmedString(toRecord(row)?.label) === label) {
        return true;
      }
    }
  }

  return false;
}

function normalizePercentFromFraction(value: number): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  if (value >= 0 && value <= 1) {
    return value * 100;
  }

  if (value >= 0 && value <= 100) {
    return value;
  }

  return undefined;
}

function extractUpdatedAt(payload: RawProviderPayload): string | undefined {
  const usage = toRecord(payload.usage);
  const credits = toRecord(payload.credits);
  const dashboard = toRecord(payload.openaiDashboard);
  const status = toRecord(payload.status);

  return (
    toNonBlankString(payload.updatedAt) ??
    toNonBlankString(usage?.updatedAt) ??
    toNonBlankString(credits?.updatedAt) ??
    toNonBlankString(dashboard?.updatedAt) ??
    toNonBlankString(status?.updatedAt)
  );
}

function extractResolvedSource(payload: RawProviderPayload): string | undefined {
  return toTrimmedString(payload.source);
}

// Every meter the card renders is built here, whatever payload shape it came
// from: raw Primary/Secondary/Tertiary slots, named extra rate windows, or
// versioned presentation meters. Pacing eligibility follows the slot for usage
// meters and the extra-window rule for supplemental ones.
type MeterInput = {
  usedPercent: number;
  remainingPercent: number;
  resetsAt?: string;
  windowMinutes?: number;
  resetDescription?: string;
  nextRegenPercent?: number;
};

type MeterContext = {
  providerId: string;
  pacingAllowed: boolean;
  now: number;
};

function meterContext(providerId: string, payload: RawProviderPayload, now: number): MeterContext {
  return { providerId, pacingAllowed: allowsUsagePacing(providerId, payload), now };
}

function computeMeterPacing(
  slot: SlotTitle | "extra",
  input: MeterInput,
  { providerId, pacingAllowed, now }: MeterContext,
): ProviderUsagePacing | undefined {
  if (!pacingAllowed || !input.resetsAt) {
    return undefined;
  }

  const window = {
    windowMinutes: input.windowMinutes,
    resetsAt: input.resetsAt,
    resetDescription: input.resetDescription,
  };
  const resolved =
    slot === "extra" ? resolveExtraWindowPace(providerId, window) : resolveSlotPace(providerId, slot, window, now);
  if (!resolved) {
    return undefined;
  }

  const pacing = calculateUsagePacing(
    {
      usedPercent: input.usedPercent,
      remainingPercent: input.remainingPercent,
      resetsAt: input.resetsAt,
      windowMinutes: resolved.windowMinutes,
    },
    now,
    resolved.defaultWindowMinutes,
  );
  return pacing ? { ...pacing, context: resolved.context } : undefined;
}

function buildUsageMeter(
  slot: SlotTitle,
  displayTitle: string,
  input: MeterInput,
  context: MeterContext,
  usageItemId: string,
): ProviderUsageSection {
  return {
    kind: "usage",
    title: slot,
    displayTitle,
    remainingPercent: clampPercent(input.remainingPercent),
    resetsIn: input.resetsAt ? formatCountdown(input.resetsAt, context.now) : undefined,
    usagePacing: computeMeterPacing(slot, input, context),
    nextRegenPercent: input.nextRegenPercent,
    usageItemId,
  };
}

function buildSupplementalMeter(
  title: string,
  input: MeterInput,
  context: MeterContext,
  usageItemId?: string,
): ProviderSupplementalUsageSection {
  return {
    kind: "supplementalUsage",
    title,
    remainingPercent: clampPercent(input.remainingPercent),
    resetsIn: input.resetsAt ? formatCountdown(input.resetsAt, context.now) : undefined,
    usagePacing: computeMeterPacing("extra", input, context),
    nextRegenPercent: input.nextRegenPercent,
    ...(usageItemId ? { usageItemId } : {}),
  };
}

function dynamicWindow(record: Record<string, unknown> | undefined, resetTimestamp?: string): DynamicWindow {
  return {
    present: record !== undefined,
    usedPercent: toFiniteNumber(record?.usedPercent),
    windowMinutes: toFiniteNumber(record?.windowMinutes),
    resetsAt: toNonBlankString(record?.resetsAt) ?? resetTimestamp,
    resetDescription: toTrimmedString(record?.resetDescription),
  };
}

function buildUsageSections(providerId: string, payload: RawProviderPayload, now = Date.now()): ProviderSection[] {
  const usage = toRecord(payload.usage);
  const sections: ProviderSection[] = [];
  const resetsAtByTitle: Partial<Record<"Primary" | "Secondary", string | undefined>> = {};
  const slotFallbacks = [
    {
      title: "Primary" as const,
      record: toRecord(usage?.primary),
      remainingPercent:
        toFiniteNumber(payload.sessionPercentLeft) ??
        normalizePercentFromFraction(toFiniteNumber(payload.remainingFraction) ?? Number.NaN) ??
        toFiniteNumber(payload.remainingPercent),
      resetTimestamp: toNonBlankString(payload.sessionResetsAt) ?? toNonBlankString(payload.resetsAt),
    },
    {
      title: "Secondary" as const,
      record: toRecord(usage?.secondary),
      remainingPercent: toFiniteNumber(payload.weeklyPercentLeft),
      resetTimestamp: toNonBlankString(payload.weeklyResetsAt),
    },
    {
      title: "Tertiary" as const,
      record: toRecord(usage?.tertiary),
      remainingPercent: undefined,
      resetTimestamp: undefined,
    },
  ];
  const windows: Record<SlotTitle, DynamicWindow> = {
    Primary: dynamicWindow(slotFallbacks[0].record, slotFallbacks[0].resetTimestamp),
    Secondary: dynamicWindow(slotFallbacks[1].record, slotFallbacks[1].resetTimestamp),
    Tertiary: dynamicWindow(slotFallbacks[2].record, slotFallbacks[2].resetTimestamp),
  };
  const hasAgentDetailRow = usageHasDetailRow(usage, "Agent");
  const context = meterContext(providerId, payload, now);

  for (const slot of slotFallbacks) {
    const record = slot.record ?? {};
    const usedPercent = toFiniteNumber(record.usedPercent);
    const progressPercent =
      slot.remainingPercent ?? (usedPercent !== undefined ? Math.max(0, 100 - usedPercent) : undefined);
    if (progressPercent === undefined) {
      continue;
    }

    const resolvedResetsAt = toNonBlankString(record.resetsAt) ?? slot.resetTimestamp;
    if (slot.title === "Primary" || slot.title === "Secondary") {
      resetsAtByTitle[slot.title] = resolvedResetsAt;
    }
    const windowMinutes = toFiniteNumber(record.windowMinutes);
    const resetDescription = toTrimmedString(record.resetDescription);
    const displayTitle =
      resolveDynamicSlotTitle(providerId, slot.title, {
        windows,
        hasAgentDetailRow,
        now,
      }) ?? getProviderUsageSectionDisplayTitle(providerId, slot.title);
    sections.push(
      buildUsageMeter(
        slot.title,
        displayTitle,
        {
          usedPercent: usedPercent ?? Math.max(0, 100 - progressPercent),
          remainingPercent: progressPercent,
          resetsAt: resolvedResetsAt,
          windowMinutes,
          resetDescription,
          nextRegenPercent: toFiniteNumber(record.nextRegenPercent),
        },
        context,
        usageItemIdForSlot(providerId, slot.title, windowMinutes),
      ),
    );
  }

  // Raw path only (presentation meters never call this). Codex weekly-empty caps session.
  if (providerId === "codex") {
    return applyCodexWeeklySessionCap(sections, resetsAtByTitle, now);
  }

  return sections;
}

function buildExtraRateWindowSections(
  providerId: string,
  payload: RawProviderPayload,
  now = Date.now(),
): ProviderSection[] {
  const usage = toRecord(payload.usage);
  const extraRateWindows = Array.isArray(usage?.extraRateWindows) ? usage.extraRateWindows : [];
  const sections: ProviderSection[] = [];
  const context = meterContext(providerId, payload, now);

  for (const entry of extraRateWindows) {
    const record = toRecord(entry);
    if (!record) {
      continue;
    }

    const title = toTrimmedString(record.title) ?? toTrimmedString(record.id);
    const window = toRecord(record.window);
    const usedPercent = toFiniteNumber(window?.usedPercent);
    if (!title || !window || usedPercent === undefined) {
      continue;
    }

    sections.push(
      buildSupplementalMeter(
        title,
        {
          usedPercent,
          remainingPercent: Math.max(0, 100 - usedPercent),
          resetsAt: toNonBlankString(window.resetsAt),
          windowMinutes: toFiniteNumber(window.windowMinutes),
          resetDescription: toTrimmedString(window.resetDescription),
          nextRegenPercent: toFiniteNumber(window.nextRegenPercent),
        },
        context,
        usageItemIdFromMeterId(toTrimmedString(record.id)),
      ),
    );
  }

  return sections;
}

type PresentationMeterKind = "primary" | "secondary" | "tertiary" | "supplemental";

const PRESENTATION_SLOT_TITLES: Record<Exclude<PresentationMeterKind, "supplemental">, SlotTitle> = {
  primary: "Primary",
  secondary: "Secondary",
  tertiary: "Tertiary",
};

function toPresentationMeterKind(value: unknown): PresentationMeterKind | undefined {
  if (value === "primary" || value === "secondary" || value === "tertiary" || value === "supplemental") {
    return value;
  }

  return undefined;
}

function buildPresentationMeterSections(
  providerId: string,
  payload: RawProviderPayload,
  now = Date.now(),
): { schemaVersion: number; sections: ProviderSection[] } | undefined {
  const presentation = toRecord(payload.presentation);
  const schemaVersion = toFiniteNumber(presentation?.schemaVersion);
  if (schemaVersion !== 1 || !Array.isArray(presentation?.meters)) {
    return undefined;
  }

  const sections: ProviderSection[] = [];
  const context = meterContext(providerId, payload, now);
  for (const entry of presentation.meters) {
    const meter = toRecord(entry);
    const kind = toPresentationMeterKind(meter?.kind);
    const label = toTrimmedString(meter?.label);
    if (!meter || !kind || !label) {
      continue;
    }

    const usedPercent = toFiniteNumber(meter.usedPercent);
    const reportedRemainingPercent = toFiniteNumber(meter.remainingPercent);
    const remainingPercent =
      reportedRemainingPercent ?? (usedPercent === undefined ? undefined : Math.max(0, 100 - usedPercent));
    if (remainingPercent === undefined) {
      continue;
    }

    const input: MeterInput = {
      usedPercent: usedPercent ?? Math.max(0, 100 - remainingPercent),
      remainingPercent,
      resetsAt: toNonBlankString(meter.resetsAt),
      windowMinutes: toFiniteNumber(meter.windowMinutes),
      resetDescription: toTrimmedString(meter.resetDescription),
      nextRegenPercent: toFiniteNumber(meter.nextRegenPercent),
    };

    const meterId = toTrimmedString(meter.id);
    sections.push(
      kind === "supplemental"
        ? buildSupplementalMeter(label, input, context, usageItemIdFromMeterId(meterId))
        : buildUsageMeter(
            PRESENTATION_SLOT_TITLES[kind],
            label,
            input,
            context,
            usageItemIdFromMeterId(meterId) ?? `metric:${kind}`,
          ),
    );
  }

  return { schemaVersion, sections };
}

function collectFromArray(payload: unknown[]): ProviderCandidate[] {
  const candidates: ProviderCandidate[] = [];

  for (const entry of payload) {
    const record = toRecord(entry);
    if (!record) {
      continue;
    }

    candidates.push({ id: toNonBlankString(record.provider) ?? toNonBlankString(record.id), payload: record });
  }

  return candidates;
}

function collectCandidates(payload: unknown): ProviderCandidate[] {
  if (Array.isArray(payload)) {
    return collectFromArray(payload);
  }

  const record = toRecord(payload);
  if (!record) {
    return [];
  }

  const providers = record.providers;
  if (providers !== undefined) {
    return collectCandidates(providers);
  }

  const data = toRecord(record.data);
  if (data?.providers !== undefined) {
    return collectCandidates(data.providers);
  }

  return [{ id: toNonBlankString(record.provider) ?? toNonBlankString(record.id), payload: record }];
}

function getNestedErrorMessage(payload: RawProviderPayload): string | undefined {
  const error = payload.error;
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (!isRecord(error)) {
    return undefined;
  }

  return toNonBlankString(error.message) ?? toNonBlankString(error.detail);
}

// Pulls the `status` object out of a raw usage payload (from `usage --status`)
// for the matching provider and normalizes it. Kept separate from the usage
// sections so status never rides along in the provider-detail cache.
export function extractProviderStatus(payload: unknown, providerId: string): ProviderStatus | undefined {
  const candidates = collectCandidates(payload);
  // Prefer the exact provider; otherwise fall back only to the first candidate
  // that actually carries a status (mirroring extractProviderErrorMessage). A
  // blind `candidates[0]` would surface a neighbouring provider's status for the
  // requested one, while this still handles a single-provider payload keyed under
  // a different id.
  const candidate =
    candidates.find((entry) => entry.id === providerId) ??
    candidates.find((entry) => parseProviderStatus(entry.payload.status) !== undefined);
  const source = candidate?.payload ?? toRecord(payload);
  if (!source) {
    return undefined;
  }

  return parseProviderStatus(source.status);
}

export function extractProviderErrorMessage(payload: unknown, providerId: string): string | undefined {
  const candidates = collectCandidates(payload);
  const candidate =
    candidates.find((entry) => entry.id === providerId) ??
    candidates.find((entry) => getNestedErrorMessage(entry.payload) !== undefined);

  return candidate ? getNestedErrorMessage(candidate.payload) : undefined;
}

function normalizePayload(providerId: string, payload: RawProviderPayload, now = Date.now()): ProviderDetailData {
  const metadata = getProviderMetadata(providerId);
  const updatedAt = extractUpdatedAt(payload);
  const fetchedAt = new Date(now).toISOString();
  const accountEmail = extractAccountEmail(payload);
  const accountOrganization = extractAccountOrganization(payload);
  const planText = formatPlanText(metadata.id, payload);
  const presentation = buildPresentationMeterSections(metadata.id, payload, now);
  const rawSections = presentation?.sections ?? [
    ...buildUsageSections(metadata.id, payload, now),
    ...buildExtraRateWindowSections(metadata.id, payload, now),
    ...buildCodexCodeReviewSection(payload, now),
    ...buildSupplementalMapperSections(payload, now),
    ...buildCodexResetCreditSection(metadata.id, payload, now),
  ];
  const sections = applyAntigravityDetailRules(metadata.id, payload, presentation !== undefined, rawSections);

  return {
    id: metadata.id,
    name: metadata.name,
    fetchedAt,
    updatedAt,
    accountEmail,
    accountOrganization,
    planText,
    source: extractResolvedSource(payload),
    presentationSchemaVersion: presentation?.schemaVersion,
    sections,
  };
}

export function normalizeProviderDetailPayload(
  payload: unknown,
  providerId: string,
  now = Date.now(),
): ProviderDetailData {
  const candidates = collectCandidates(payload);
  const candidate = candidates.find((entry) => entry.id === providerId) ?? candidates[0];

  if (candidate) {
    return normalizePayload(providerId, candidate.payload, now);
  }

  const record = toRecord(payload);
  if (record) {
    return normalizePayload(providerId, record, now);
  }

  return normalizePayload(providerId, { provider: providerId }, now);
}
