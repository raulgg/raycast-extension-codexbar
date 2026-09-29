#!/usr/bin/env node

// Checks the assembled provider catalog, provider modules, and paceCapabilities.ts against the upstream
// CodexBar provider descriptors so the Raycast extension shows the same provider
// names, usage-bar labels, dashboard and status URLs, brand colors, and pace gating
// as the CodexBar GUI. A module pace, displayTitle, or extraWindowPace replaces that
// id in the legacy tables. Every dynamic label override in the upstream renderers is
// either ported or documented as unportable. The check also fails when two modules
// share an alias, or an alias is any provider id.
//
// Usage:
//   npm run upstream:check                      # compare against codexbar-upstream.lock
//   npm run upstream:bump                       # check latest release, then pin lockfile
//   CODEXBAR_REF=main npm run upstream:check    # compare against a branch/tag/sha
//   CODEXBAR_DIR=~/code/CodexBar npm run ...    # compare against a local checkout
//
// Exits 1 on any undocumented divergence, missing provider, stale allowlist entry,
// unported dynamic override, pace-capability mismatch, menu-card balance drift,
// or provider-module index that does not match the directories under src/providers.

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { METER_DETAIL } from "../src/providers/meterDetail.ts";
import { PROVIDER_CATALOG, PROVIDER_MODULES } from "../src/providers/index.ts";
import {
  DYNAMIC_SLOT_TITLES,
  EXTRA_WINDOW_PACE_PROVIDER_IDS,
  PACE_CAPABILITIES,
  UNPORTABLE_DYNAMIC_TITLES,
} from "../src/providers/paceCapabilities.ts";
import {
  checkMeterDetailFile,
  compareMeterDetail,
  compareUnportableMenuCard,
  menuCardReviewProblems,
  parseMenuCardPresentation,
} from "./lib/meter-detail.mjs";
import { checkProviderModuleIndex } from "./lib/provider-modules.mjs";
import {
  createUpstreamSource,
  isMainModule,
  readFilesWithConcurrency,
  readMenuCardReviewed,
  readUpstreamLock,
  upstreamLockPath,
} from "./lib/upstream.mjs";
import { compareProviders, parseDescriptorMetadata, parseDynamicOverrideProviders } from "./lib/upstream-metadata.mjs";
import {
  comparePaceCapabilities,
  dynamicTitleIdsForCheck,
  extraWindowIdsForCheck,
  moduleAliasProblems,
  paceCapabilitiesForCheck,
  parseDescriptorPace,
  parseExtraRateWindowPaceProviders,
  parsePresentationPaceFlags,
  parseSecondarySessionPaceProviders,
} from "./lib/upstream-pace.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESCRIPTOR_DIR = "Sources/CodexBarCore/Providers";
// Renderer files that set usage-bar titles. A dynamic override in any of them must be
// ported or listed as unportable. Fixed list: a renamed or deleted file fails on read,
// but a brand-new renderer is invisible until someone adds it here.
const RENDERER_PATHS = [
  "Sources/CodexBar/MenuDescriptor.swift",
  "Sources/CodexBar/MenuCardView+ModelHelpers.swift",
  "Sources/CodexBar/UsageStore+WidgetSnapshot.swift",
  "Sources/CodexBarCLI/CLIRenderer.swift",
  "Sources/CodexBarCLI/DashboardSnapshotBuilder.swift",
];

// Menu card files that special-case pace outside descriptor `pace:` (Kimi secondary
// sessionPaceDetail). Kept separate from RENDERER_PATHS so a file without label
// sites does not break the dynamic-override scan.
const PACE_RENDERER_PATHS = [
  "Sources/CodexBar/MenuCardView.swift",
  "Sources/CodexBar/MenuCardView+ModelHelpers.swift",
];

// Custom Swift closures, keyed provider.field. fingerprint is the expanded Swift body.
// matcher: "always" resolves an always-true closure (`_, _ in true`) to { type: "always" }.
// matcher: "windowDurationAtMost" resolves that fingerprint to the structured rule.
// matcher: "predicate" resolves it to { type: "predicate", id } on the module. The
// pace engine calls that field's matches function. The fingerprint still has to
// match the Swift body.
// Hand-edited list. upstream:prune removes an id only when CodexBar no longer ships that Provider.
const CUSTOM_PACE_RULES = {
  "claude.sessionPaceWindowRule": {
    matcher: "always",
    fingerprint: "_, _ in true",
  },
  "codex.sessionPaceWindowRule": {
    matcher: "predicate",
    id: "codexSessionRejectsWeeklyMonthly",
    fingerprint:
      "window, _ in guard let minutes = window.windowMinutes else { return true } return minutes != 7 * 24 * 60 && minutes != 30 * 24 * 60",
  },
  "grok.resetWindowPace": {
    matcher: "predicate",
    id: "grokWeeklyCredits",
    fingerprint:
      'window, now in guard Self.primaryLabel(window: window, now: now) == "Weekly", let resetsAt = window.resetsAt else { return false } let windowMinutes = window.windowMinutes ?? 7 * 24 * 60 let timeUntilReset = resetsAt.timeIntervalSince(now) return windowMinutes > 0 && timeUntilReset > 0 && timeUntilReset <= TimeInterval(windowMinutes) * 60',
  },
  "notion.sessionPaceWindowRule": {
    matcher: "windowDurationAtMost",
    fingerprint:
      "window, _ in guard let minutes = window.windowMinutes else { return false } return minutes <= 360",
  },
  "zai.resetWindowPace": {
    matcher: "predicate",
    id: "zaiMonthlyMcp",
    fingerprint: 'window.windowMinutes == 43200 && window.resetDescription == "MCP"',
  },
  "zai.inferredMonthlyDuration": {
    matcher: "predicate",
    id: "zaiMonthlyMcp",
    fingerprint: 'window.windowMinutes == 43200 && window.resetDescription == "MCP"',
  },
  "amp.resetWindowPace": {
    matcher: "predicate",
    id: "ampRenewsInDescription",
    fingerprint: 'window, _ in window.windowMinutes != nil && window.resetDescription?.hasPrefix("renews in ") == true',
  },
  "ollama.sessionPaceWindowRule": {
    matcher: "windowDurationAtMost",
    fingerprint:
      "window, _ in guard let minutes = window.windowMinutes else { return false } return minutes <= 300",
  },
};

// Hand-edited list. upstream:prune removes an id only when CodexBar no longer ships that Provider.
const UNPORTABLE_PRESENTATION_PACE = {
  abacus: {
    usesAbacusPace: "billing-cycle copy on the primary bar, not UsagePace",
  },
  synthetic: {
    usesSyntheticRollingRegen: "rolling regen detail, not usage pace",
  },
};

// Hand-edited list. upstream:prune removes an id only when CodexBar no longer ships that Provider.
const UNPORTABLE_HEADROOM_HINT = {
  codex: "1.5× session headroom hint, not implemented",
};

// Hand-edited list. upstream:prune removes an id only when CodexBar no longer ships that Provider.
// Balance flags have no entry here: regenerate src/providers/meterDetail.ts instead.
const UNPORTABLE_MENU_CARD = {
  abacus: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  aixy: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  azureopenai: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  bifrost: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  chutes: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  cursor: {
    requestQuota: "CLI JSON does not expose the Request quota row",
  },
  deepinfra: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  deepseek: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
    usageNotesResolver: "usage notes resolver, not the balance line",
  },
  helmcode: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  kilo: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  litellm: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  llmman: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  longcat: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  manus: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  mimo: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  mistral: {
    extraRateWindowUsesResetDescriptionAsDetail: "extra rate window, not the primary or secondary balance line",
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  neuralwatt: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  ollama: {
    usageNotesResolver: "usage notes resolver, not the balance line",
  },
  openai: {
    usageNotesResolver: "usage notes resolver, not the balance line",
  },
  qoder: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  raycast: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  sub2api: {
    extraRateWindowUsesResetDescriptionAsDetail: "extra rate window, not the primary or secondary balance line",
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
  warp: {
    primaryDescriptionIsDetail: "menu descriptor, not the under-bar line",
  },
};

// Known intentional differences from upstream, keyed provider then field. Entries record
// the exact value pair they excuse. When either side moves, the checker flags the entry
// as stale so it gets re-reviewed instead of rotting. "expr:" upstream values are Swift
// expressions the parser cannot resolve. `ours` is the manually resolved constant.
// Hand-edited list. upstream:prune removes an id only when CodexBar no longer ships that Provider.
const ALLOWED_DIVERGENCES = {
  alibaba: {
    dashboardUrl: {
      ours: "https://modelstudio.console.alibabacloud.com/ap-southeast-1/?tab=coding-plan#/efm/coding_plan",
      upstream: "expr:AlibabaCodingPlanAPIRegion.international.dashboardURL.absoluteString",
      reason: "upstream computes the URL per region; ours is the resolved .international constant",
    },
  },
  alibabatokenplan: {
    dashboardUrl: {
      ours: "https://bailian.console.aliyun.com/cn-beijing?tab=plan#/efm/subscription/token-plan",
      upstream: "expr:AlibabaTokenPlanUsageFetcher.dashboardURL.absoluteString",
      reason: "upstream computes the URL; ours is the resolved constant from AlibabaTokenPlanUsageFetcher",
    },
  },
  zai: {
    dashboardUrl: {
      ours: "https://z.ai/manage-apikey/coding-plan/personal/my-plan",
      upstream: "expr:ZaiAPIRegion.global.dashboardURL.absoluteString",
      reason: "upstream computes the URL per region; ours is the resolved .global constant",
    },
  },
  qoder: {
    dashboardUrl: {
      ours: "https://qoder.com/account/usage",
      upstream: "expr:QoderWebSite.international.dashboardURL.absoluteString",
      reason: "upstream computes the URL per site; ours is the resolved .international constant",
    },
  },
  qwencloud: {
    dashboardUrl: {
      ours: "https://home.qwencloud.com/billing/subscription/token-plan-individual",
      upstream: "expr:QwenCloudUsageFetcher.dashboardURL.absoluteString",
      reason: "upstream computes the URL from QWEN_CLOUD_HOST; ours is the empty-env default",
    },
  },
  wayfinder: {
    dashboardUrl: {
      ours: "http://127.0.0.1:8088/router",
      upstream: "expr:WayfinderSettingsReader.dashboardURL(environment: [:]).absoluteString",
      reason: "upstream builds dashboard from WAYFINDER_GATEWAY_URL; ours is the empty-env default (http://127.0.0.1:8088/router)",
    },
  },
  kimi: {
    dashboardUrl: {
      ours: "https://www.kimi.com/code/console",
      upstream: "expr:KimiRegion.china.consoleURL.absoluteString",
      reason: "upstream computes the URL per region; ours is the resolved .china constant (www.kimi.com/code/console)",
    },
  },
  llmman: {
    dashboardUrl: {
      ours: "http://127.0.0.1:17434",
      upstream: "expr:LLMManSettingsReader.defaultBaseURL.absoluteString",
      reason: "upstream reads the local llmman serve URL; ours is LLMManSettingsReader.defaultBaseURL",
    },
  },
};

const upstreamLockText = readFileSync(upstreamLockPath(), "utf8");

export const DEFAULT_POLICY = {
  catalog: PROVIDER_CATALOG,
  modules: PROVIDER_MODULES,
  paceCapabilities: PACE_CAPABILITIES,
  extraWindowIds: EXTRA_WINDOW_PACE_PROVIDER_IDS,
  implementedTitles: new Set(Object.keys(DYNAMIC_SLOT_TITLES)),
  unportableTitles: UNPORTABLE_DYNAMIC_TITLES,
  customPaceRules: CUSTOM_PACE_RULES,
  allowedDivergences: ALLOWED_DIVERGENCES,
  unportableHeadroom: UNPORTABLE_HEADROOM_HINT,
  unportablePresentation: UNPORTABLE_PRESENTATION_PACE,
  meterDetail: METER_DETAIL,
  unportableMenuCard: UNPORTABLE_MENU_CARD,
  menuCardReviewed: readMenuCardReviewed(upstreamLockText),
  pinnedSha: readUpstreamLock(upstreamLockText).sha,
  rendererPaths: RENDERER_PATHS,
  paceRendererPaths: PACE_RENDERER_PATHS,
};

export async function checkUpstream(source, policy = DEFAULT_POLICY) {
  const {
    catalog,
    modules = {},
    paceCapabilities,
    extraWindowIds,
    implementedTitles,
    unportableTitles,
    customPaceRules,
    allowedDivergences,
    unportableHeadroom,
    unportablePresentation,
    meterDetail = METER_DETAIL,
    unportableMenuCard = UNPORTABLE_MENU_CARD,
    menuCardReviewed,
    pinnedSha,
    rendererPaths,
    paceRendererPaths,
  } = policy;

  const paceEntries = new Map(Object.entries(paceCapabilitiesForCheck(paceCapabilities, modules)));
  const titleIds = dynamicTitleIdsForCheck(implementedTitles, modules);
  const effectiveExtraWindowIds = extraWindowIdsForCheck(extraWindowIds, modules);

  // `<Name>ProviderDescriptor.swift` files only. The bare ProviderDescriptor.swift is
  // the shared registry/protocol file, not a provider.
  const descriptorPaths = (await source.listFiles(DESCRIPTOR_DIR, "ProviderDescriptor.swift")).filter(
    (filePath) => !filePath.endsWith("/ProviderDescriptor.swift"),
  );
  if (descriptorPaths.length === 0) {
    throw new Error(`No provider descriptors found under ${DESCRIPTOR_DIR} in ${source.label}.`);
  }
  const [descriptorFiles, rendererFiles, paceRendererFiles] = await Promise.all([
    readFilesWithConcurrency(source, descriptorPaths),
    readFilesWithConcurrency(source, rendererPaths),
    readFilesWithConcurrency(source, paceRendererPaths),
  ]);

  const upstreamById = new Map();
  const presentationFlagsById = new Map();
  const menuCards = new Map();
  const menuCardProblems = [];
  for (const { path: filePath, content } of descriptorFiles) {
    const metadata = parseDescriptorMetadata(content, filePath);
    metadata.pace = parseDescriptorPace(content, filePath);
    upstreamById.set(metadata.id, metadata);
    presentationFlagsById.set(metadata.id, parsePresentationPaceFlags(content));
    const menuCard = parseMenuCardPresentation(content, filePath);
    if (!menuCard.ok) {
      menuCardProblems.push(menuCard.error);
      continue;
    }
    menuCards.set(metadata.id, menuCard.presentation);
  }

  const problems = compareProviders(catalog, upstreamById, allowedDivergences);
  problems.push(...menuCardProblems);
  const paceComparison = comparePaceCapabilities(paceEntries, upstreamById, customPaceRules);
  problems.push(...paceComparison.problems);
  problems.push(...moduleAliasProblems(modules, Object.keys(catalog)));

  const dynamicOverrides = parseDynamicOverrideProviders(rendererFiles);
  for (const metadata of upstreamById.values()) {
    if (metadata.definesDynamicPrimaryLabel || metadata.definesRateWindowLabeler) {
      dynamicOverrides.add(metadata.id);
    }
  }
  for (const providerId of dynamicOverrides) {
    if (titleIds.has(providerId) || Object.hasOwn(unportableTitles, providerId)) {
      continue;
    }
    problems.push(
      `${providerId}: upstream renderers apply a dynamic label override the extension does not implement ` +
        `(port it on the provider module or in paceCapabilities.ts DYNAMIC_SLOT_TITLES)`,
    );
  }
  for (const providerId of [...titleIds, ...Object.keys(unportableTitles)]) {
    if (!dynamicOverrides.has(providerId)) {
      problems.push(
        `${providerId}: listed as a dynamic override but upstream renderers no longer apply one. ` +
          `remove it from the provider module / DYNAMIC_SLOT_TITLES / UNPORTABLE_DYNAMIC_TITLES.`,
      );
    }
  }

  const extraWindowProviders = parseExtraRateWindowPaceProviders(paceRendererFiles);
  for (const id of extraWindowProviders) {
    if (!effectiveExtraWindowIds.has(id)) {
      problems.push(
        `${id}: MenuCardView paces extra rate windows but neither EXTRA_WINDOW_PACE_PROVIDER_IDS nor a module extraWindowPace includes it`,
      );
    }
  }
  for (const id of effectiveExtraWindowIds) {
    if (!extraWindowProviders.has(id)) {
      problems.push(
        `${id}: extra-window pace is set but MenuCardView extraRateWindowPaceDetail no longer names it`,
      );
    }
  }

  const rendererSessionProviders = parseSecondarySessionPaceProviders(paceRendererFiles);
  for (const id of rendererSessionProviders) {
    if (paceEntries.get(id)?.secondarySessionPace !== true) {
      problems.push(
        `${id}: MenuCardView session-paces the secondary window but neither the provider module nor paceCapabilities.ts sets secondarySessionPace: true`,
      );
    }
  }
  for (const [id, capability] of paceEntries) {
    if (capability.secondarySessionPace && !rendererSessionProviders.has(id)) {
      problems.push(
        `${id}: the provider module or paceCapabilities.ts sets secondarySessionPace but MenuCardView no longer session-paces that slot`,
      );
    }
  }

  const usedHeadroom = new Set();
  for (const [id, metadata] of upstreamById) {
    if (!metadata.pace.showsHeadroomHint) {
      continue;
    }
    if (!unportableHeadroom[id]) {
      problems.push(`${id}: descriptor sets showsHeadroomHint. Port it or add UNPORTABLE_HEADROOM_HINT.`);
      continue;
    }
    usedHeadroom.add(id);
  }
  for (const id of Object.keys(unportableHeadroom)) {
    if (!usedHeadroom.has(id)) {
      problems.push(`${id}: stale UNPORTABLE_HEADROOM_HINT. Delete it.`);
    }
  }

  const usedPresentation = new Set();
  for (const [id, flags] of presentationFlagsById) {
    const allowance = unportablePresentation[id] ?? {};
    for (const flag of ["usesAbacusPace", "usesSyntheticRollingRegen"]) {
      if (!flags[flag]) {
        continue;
      }
      if (!allowance[flag]) {
        problems.push(
          `${id}: descriptor sets ${flag} (presentation-only pace). Port it or add UNPORTABLE_PRESENTATION_PACE.`,
        );
        continue;
      }
      usedPresentation.add(`${id}.${flag}`);
    }
  }
  for (const [id, flags] of Object.entries(unportablePresentation)) {
    for (const flag of Object.keys(flags)) {
      if (!usedPresentation.has(`${id}.${flag}`)) {
        problems.push(`${id}: stale UNPORTABLE_PRESENTATION_PACE entry for ${flag}. Delete it.`);
      }
    }
  }

  const meterComparison = compareMeterDetail(menuCards, meterDetail);
  problems.push(...meterComparison.problems);
  problems.push(...compareUnportableMenuCard(menuCards, unportableMenuCard));
  if (menuCardReviewed) {
    problems.push(...(await reviewMenuCard(source, menuCardReviewed, pinnedSha)));
  }

  return {
    problems,
    meterEntries: meterComparison.entries,
    label: source.label,
    catalogCount: Object.keys(catalog).length,
    overrideCount: dynamicOverrides.size,
    paceCount: paceEntries.size,
  };
}

// Bump checks the candidate before it rewrites the lock pin. A copied review sha still has to name every changed path.
async function reviewMenuCard(source, reviewed, pinnedSha) {
  if (!source.sha || typeof source.listChangedPaths !== "function") {
    return ["menuCardReviewed needs an upstream source sha and a path diff."];
  }
  if (typeof pinnedSha !== "string" || !/^[0-9a-f]{40}$/i.test(pinnedSha)) {
    return ["menuCardReviewed needs the pinned lock sha."];
  }
  const candidate = source.sha.toLowerCase();
  const pin = pinnedSha.toLowerCase();
  const changed = pin === candidate ? [] : await source.listChangedPaths(pin, candidate);
  return menuCardReviewProblems(reviewed, candidate, changed);
}

async function main() {
  const source = await createUpstreamSource();
  const [indexProblems, result] = await Promise.all([checkProviderModuleIndex(ROOT), checkUpstream(source)]);
  const detailProblems = await checkMeterDetailFile(ROOT, result.meterEntries);
  const problems = [...indexProblems, ...result.problems, ...detailProblems];
  if (problems.length > 0) {
    console.error(`Catalog out of sync with ${result.label}:\n`);
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Catalog in sync: ${result.catalogCount} providers match ${result.label} ` +
      `(labels, names, URLs, colors, ${result.overrideCount} dynamic overrides, ` +
      `${result.paceCount} pace capabilities accounted for).`,
  );
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
