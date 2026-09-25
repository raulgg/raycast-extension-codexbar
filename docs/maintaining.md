# Maintaining CodexBar (Raycast extension)

Onboarding and reference for contributors. What the pieces are, how to run and test them, the runtime
quirks that trip people up, and the recurring chore of syncing with upstream.

- **What upstream is, and how to track it** → [`upstream-parity.md`](upstream-parity.md). Read it
  before touching provider metadata, pacing, or icons.
- **The words the code and docs use** → [`CONTEXT.md`](../CONTEXT.md). Provider, Reset window,
  Primary/Secondary/Tertiary, Pacing, etc. Use these terms; avoid the listed synonyms.
- **Why the runtime is shaped the way it is** → [`adr/`](adr/). Nine decisions, each with its cost.

## Canonical repo

This GitHub repository (`raulgg/raycast-extension-codexbar`) is where the extension is developed
and where issues and discussions live. The Raycast Store publishes a copy from `raycast/extensions`
(`extensions/codexbar`), and contributors may open pull requests in either place. Where things go,
how credit is preserved, and the `pull-contributions` / `npm run publish` sync steps are in
[`CONTRIBUTING.md`](../CONTRIBUTING.md). Until the first Store release lands there is nothing in
`raycast/extensions` to sync.

Develop here and load the extension with `npm run dev` from this directory. Only work from a copy
inside `raycast/extensions` when you are following Raycast's contribute-to-an-extension flow.

## What this extension does, in one paragraph

It shells out to an external `codexbar` CLI (or its `serve` HTTP mode), normalizes the JSON into
usage sections, and renders one row per Configured Provider with usage meters, pacing markers, and
incident badges. It does not fetch any provider's API or statuspage itself. The CLI owns all data
acquisition. The extension owns interpretation and rendering, re-implemented from the CodexBar
macOS app.

## Repo layout

```
src/
  usage-overview.tsx          Command: Usage Overview (view). The main UI entry point.
  refresh-usage-cache.ts      Command: no-view, 10-min interval. Warms caches + serve. (ADR-0002/0003)
  preferences.ts              Typed access to Raycast preferences (Hide Personal Information).

  cli/                        The CodexBar CLI process boundary.
    exec.ts                   execFile wrapper, child env, JSON extraction, error classification,
                              CodexBarCliError.
    binary.ts                 CLI discovery (PATH + fallbacks), --version smoke test, capability
                              negotiation, getCodexBarAvailability. (ADR-0005/0008)
    serve.ts                  Serve HTTP client, health check, process attestation (lsof/ps),
                              start/stop/restart. (ADR-0002/0006/0009)
    serveState.ts             Cache record of the serve daemon we started (pid, start time,
                              Keychain policy) so a later run can attest it. (ADR-0006/0009)
    fetch.ts                  fetchUsage: one Provider's raw usage payload via serve, one-shot,
                              or auto (serve with one-shot fallback). Never normalizes. (ADR-0005)
    keychainAccessPolicy.ts   The "default" | "disabled" policy and the env var that enforces it
                              on every CodexBar child process. (ADR-0009)
    install.ts                Install help state + the port of the app's Install CLI button. (ADR-0008)
    mockPayloads.ts           Dev-only fixture payloads and the DEV_MOCK flag (see "Working with
                              mock data").

  services/
    codexbarClient.ts         CodexBarClient: one object for everything the extension asks of a
                              CodexBar installation (config, roster, serve, usage fetches). The real
                              client wraps cli/ + providerConfig; the mock client answers from
                              mockPayloads. Chosen once in getCodexBarClientAvailability.
                              useCachedPromise stores loadCodexBarAvailabilitySnapshot (plain JSON).
                              The hook rebuilds the client with hydrateCodexBarClientAvailability.
    providerDetail.ts         loadProviderDetail: raw payload -> ProviderDetailData. The only
                              place normalize, payload-error rejection, section memory
                              (ADR-0007), and the Keychain error hint are composed.
    providerDetailStore.ts    Framework-free scheduler behind the Usage Overview: per-provider
                              dedupe and force chaining, once-per-open refresh, stale-context
                              discard, optimistic cached results. useProviderDetails is a thin
                              useSyncExternalStore binding over it.
    backgroundRefresh.ts      Orchestration for refresh-usage-cache.

  config/
    providerConfig.ts         Read ~/.codexbar/config.json; enable/disable via CLI; reorder via
                              direct file write. (ADR-0001/0004)

  cache/                      Raycast Cache stores.
    indexedCache.ts           Shared plumbing: schema-versioned per-policy keys, provider index,
                              legacy sweeps, prune loop.
    providerDetailCache.ts    Provider detail cache (per Keychain policy, 10-min fresh / 60-min
                              stale), failure counters, and the fetch worker pool. (ADR-0005)
    sectionMemory.ts          Remembered supplemental sections restored when a payload drops
                              them (24-h TTL). (ADR-0007)
    providerStatusCache.ts    Dedicated status cache (provider-status:<id>, 30-min TTL). (ADR-0003)

  render/                     The SVG detail card and list accessory icon. Pure string builders.
    svg.ts                    SVG primitives: text, rect, line, progress bar with pace tick.
    layout.ts                 Panel constants, palettes, typography, header and divider markup.
    format.ts                 Text formatting (remaining percent, relative update time). No SVG.
    errorCard.ts              The detail-panel card shown when a Provider's fetch failed.
    usageMeter.ts             Usage-meter widget (title row, bar, pacing footer) for the detail card.
    detailCard.ts             Detail-card composer: header, meters, info, status, markdown wrap.
    accessoryIcon.ts          Two-bar list accessory icon.

  providers/                  Upstream-synced provider knowledge. Script-guarded; see upstream-parity.md.
    catalog.ts                Raycast-free provider metadata + aliases. Imported by upstream:check.
    registry.ts               Raycast adapter over catalog.ts (icons, palettes, lookups).
    paceCapabilities.ts       GUI pace gating table + dynamic usage-bar title map. Imported by
                              upstream:check.

  usage/                      Raw payload -> domain model. Pure: no Raycast, no IO.
    types.ts                  Shared domain types (ProviderDetailData, sections, pacing, status).
    json.ts, duration.ts      Coercion and duration-text helpers shared across the tree.
    normalize.ts              Raw payload -> ProviderSection[]: envelope, slots, extra rate
                              windows, presentation meters, dynamic label overrides.
    identity.ts               Account email and plan text for the detail header.
    providerRules/            Provider-specific interpretation, one file per provider: codex
                              (weekly caps session, code review, reset credits), claude (plan
                              fields), kilo (pass text), antigravity (hide adornment copies),
                              openrouter (supplemental mapper table).
    pacing.ts                 The pace formula and labels. Hand-maintained (not script-diffed).
    status.ts                 Parse the CLI status object into a badge model.

  ui/                         Everything React. Talks to CodexBar through services/; imports from
                              cli/ only for error types, install help, and the Keychain policy.
    components/               UsageList (the command body), ProviderListItem, ProviderDetail,
                              ManageProviders + ManageProvidersAction, moveProviderActions,
                              InstallHelpDetail, CommandErrorDetail.
    hooks/                    useUsageOverview (client + roster), useProviderDetails (binding over
                              providerDetailStore), useProviderStatuses, useAvailableProviders,
                              useMoveProvider, useCodexBarAvailability, useProviderDetailErrorToast,
                              useRelativeUpdateTime.

scripts/
  check-upstream.mjs          npm run upstream:check      metadata, override ids, pace gating.
  bump-upstream.mjs           npm run upstream:bump       check latest release, then pin lockfile.
  sync-provider-icons.mjs     npm run upstream:sync-icons icon harvest / drift guard.
  lib/upstream.mjs            Shared upstream source (ref resolution, GitHub / local checkout).
  lib/upstream-metadata.mjs   Catalog/descriptor parse and compare (unit-tested).
  lib/upstream-pace.mjs       Descriptor pace: parse and compare (unit-tested).

docs/                         This directory. upstream-parity.md, maintaining.md, adr/.
CONTEXT.md                    Domain glossary.
```

Tests are colocated (`src/**/*.test.ts[x]`, `scripts/*.test.mjs`) with shared setup under
`test/`. There is a test next to almost every non-trivial module. Mirror that when you add code.

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | `ray develop`. Hot-reload the extension into Raycast. |
| `npm test` | Run the vitest suite once. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run lint` / `npm run fix-lint` | Raycast ESLint (`--fix` to autofix). |
| `npm run typecheck` | `tsc --noEmit` over `src/**` (tests included). Vitest does not type-check, and `ray build` runs this same check, so a type error in a test file breaks the build. |
| `npm run build` | `ray build`. Production build. |
| `npm run upstream:check` | Guard: provider metadata, override **ids**, and pace gating vs the lockfile SHA. |
| `npm run upstream:bump` | Move `codexbar-upstream.lock` to the latest GitHub release, then run both guards. |
| `npm run upstream:sync-icons [-- --check]` | Sync (or check) provider icons vs the lockfile SHA. |

Before opening a PR: `npm test && npm run typecheck && npm run lint && npm run upstream:check && npm run upstream:sync-icons -- --check`.

## Runtime quirks worth knowing

These surprise people. Each has an ADR with the full reasoning; the short version:

- **The CLI is found on `PATH`, then two fallback paths.** `resolveCodexBarBinary` searches `PATH`
  (defaulting to a Homebrew-inclusive `PATH` when Raycast's environment has none), then
  `/opt/homebrew/bin/codexbar` and `/usr/local/bin/codexbar`. The CLI can be installed standalone
  (Homebrew, GitHub releases). It does not require the CodexBar app. See `cli/binary.ts`.
- **Serve is a real daemon, started only by the background refresh.** The extension talks to
  `codexbar serve` over `127.0.0.1:17653`. Only `refresh-usage-cache` may start it; the foreground
  Usage Overview only *reads* an already-healthy serve and otherwise falls back to a one-shot CLI
  call. Opening a view must never silently spawn a long-lived process. The foreground never stops
  serve either; the background refresh sends SIGTERM only to a daemon that predates the installed
  CLI binary or was started under a different Keychain policy, and immediately replaces it. →
  **ADR-0002 / ADR-0006 / ADR-0009**.
- **Status comes only from the CLI, only in the background.** Incident badges are sourced from
  `usage --status` and cached separately (`provider-status:<id>`, 30-min TTL). Serve mode can't
  produce status, so when serve supplies detail the background path issues a status one-shot only
  if that provider's status cache is missing or past TTL, not on every 10-minute refresh. If the
  background refresh is disabled, badges simply don't appear. Graceful absence, no error, no lazy
  foreground fetch. → **ADR-0003**.
- **The shared config is written two ways.** Enable/disable goes through `codexbar config
  enable/disable` (the app-sanctioned path, with validation and side effects); reorder writes
  `~/.codexbar/config.json` directly (no CLI command exists). Both live in `providerConfig.ts` and are
  serialized in the UI so they can't clobber each other's read-modify-write. → **ADR-0001 / ADR-0004**.
- **The two caches never merge.** Serve-sourced usage writes carry no status and must not clobber a
  cached status (nor the reverse). Successful usage payloads replace atomically; fetch failures keep
  the last successful usage snapshot. → **ADR-0003 / ADR-0005**.

## Working with mock data

`src/cli/mockPayloads.ts` supplies fake payloads for development. It only activates when
`environment.isDevelopment && DEV_MOCK`. Flip the `DEV_MOCK` const to `true` locally (don't commit
it `true`); `getCodexBarClientAvailability` then hands every caller the mock `CodexBarClient`, so
no other module checks for mock mode. Incident badges appear in mock mode only after Refresh Usage
Cache has run once, since they come from the status cache like in production. Mocks matter for parity. Pacing markers only render when the mock window shapes are valid
(a session window must reset within ~5h with enough elapsed time). When you make a provider
newly pace-eligible, fix its mock too. See the pacing worked example in
[`upstream-parity.md`](upstream-parity.md).

## The recurring chore: syncing with upstream

Upstream ships often. A periodic sync pass:

1. **Point at the ref you want.** Default is the SHA in `codexbar-upstream.lock`. To take a new
   upstream release, `npm run upstream:bump`. That writes the lock only after `upstream:check` and
   `upstream:sync-icons -- --check` pass against that SHA. For iterating, clone upstream once and
   export `CODEXBAR_DIR=~/code/CodexBar` (no network, no rate limit). To preview an unreleased
   change without moving the pin, `CODEXBAR_REF=main`. Set `GITHUB_TOKEN` if you hit a `403`.
2. **Run the guards.**
   ```
   npm run upstream:check
   npm run upstream:sync-icons -- --check
   ```
3. **Fix what they flag.** New provider → add a `PROVIDER_CATALOG` entry (name, brandColor,
   labels, URLs, iconSlug) transcribed from its `…ProviderDescriptor.swift`; **don't invent values**. New
   alias → `PROVIDER_ID_ALIASES` in `catalog.ts`. Field mismatch → update the catalog, or record an
   intentional `ALLOWED_DIVERGENCES` entry with a reason. New/removed dynamic override → port it
   into `DYNAMIC_SLOT_TITLES` or mark it unportable. New descriptor `pace:` → add a
   `paceCapabilities.ts` row (GUI fields only, plus a `CUSTOM_PACE_RULES` fingerprint for `.custom`
   closures), or mark presentation-only paths in `UNPORTABLE_PRESENTATION_PACE` /
   `UNPORTABLE_HEADROOM_HINT`. Icons out of date → drop the `-- --check` and let the sync script
   write them.
4. **Re-verify the remaining hand-maintained work** the scripts can't see. Pace formula and
   labels in `usage/pacing.ts`, plus supplemental shapes, CLI install, and aliases. After a bump, commit
   the lockfile with any catalog, title, pace, or icon edits.
5. **Cite the ref.** In commit messages / plan notes / code comments, name the upstream file and SHA
   you verified against, so the next sync can tell what's already been checked.
6. **Test and lint**, then commit.

The `plans/*.local.md` files (gitignored) capture larger in-flight parity efforts (missing providers,
pace-indicator parity). They snapshot an upstream SHA and are working notes, not the source of
truth. Upstream Swift always wins over a plan's snapshot.
</content>
