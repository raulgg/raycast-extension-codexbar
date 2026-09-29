# Keeping parity with upstream

This extension mirrors behaviour from the CodexBar macOS app (`steipete/CodexBar`). The app is
upstream. This extension re-implements a subset of its usage rendering on top of the same `codexbar`
CLI payloads. When a feature "should match the app", upstream Swift is the source of truth. Not
memory, and not what the app looked like last month.

This guide is the maintainer reference for every place the extension has to track upstream. Read
it before touching provider metadata, pacing, icons, or the sync scripts. For the runtime
architecture (CLI discovery, serve, caches, config writes) see [`maintaining.md`](maintaining.md) and
the [ADRs](adr/). For the vocabulary the code and docs use, see [`CONTEXT.md`](../CONTEXT.md).

---

## The three layers, and which one owns what

| Layer | Repo / location | Owns |
| --- | --- | --- |
| **CodexBar CLI** | external `codexbar` binary | The raw `usage --provider <id>` JSON payload. Field names, window shapes, `windowMinutes`, identity, status. |
| **CodexBar app** | `steipete/CodexBar` (Swift) | How payloads are interpreted and rendered. Pacing formulas, provider metadata (names, labels, URLs, colors), which providers get which treatment, icons. |
| **This extension** | here (TypeScript) | A re-implementation of the app's rendering for Raycast. Should follow the app's interpretation decisions. |

Parity work almost always means a payload field already exists, and we need to copy the app's
decision about how to treat it. We rarely invent anything. We transcribe Swift into TypeScript.

## Upstream is the source of truth, and it moves

Upstream is the public repo `steipete/CodexBar`. It changes fast. A new provider descriptor
(`ClawRouter`) appeared between two clones taken on consecutive days. Two rules:

1. **Read the upstream Swift directly** and treat it as authoritative. Not memory, and not how the
   app behaved previously.
2. **Name the upstream file.** When you record a parity finding in a plan or in the tables
   below, name the Swift file. The release last synced is
   [`codexbar-upstream.lock`](../codexbar-upstream.lock). A source comment should name the
   Swift symbol and point here.

### Which ref? The SHA in `codexbar-upstream.lock`

The sync scripts default to the pinned commit in [`codexbar-upstream.lock`](../codexbar-upstream.lock)
(tag plus SHA of a shipped GitHub release). They do not float on `releases/latest`. Run
`npm run upstream:bump` to check the current latest release and move the pin after a clean prune,
`npm run typecheck`, `npm test`, and both guards.
Override when you need to:

| Env var | Effect |
| --- | --- |
| _(none)_ | Compare against the lockfile SHA. Missing or malformed lockfile throws. |
| `CODEXBAR_REF=main` | Compare against a branch, tag, or SHA (preview a future release). |
| `CODEXBAR_DIR=~/code/CodexBar` | Compare against a local checkout. Skips the network. Ignores the lockfile and `CODEXBAR_REF`. |
| `GITHUB_TOKEN=…` | Raise the GitHub API rate limit. The unauthenticated limit is low. A bare `403` from `api.github.com` is almost always this. Set the token or use `CODEXBAR_DIR`. |

Resolution failures throw rather than falling back to a different ref. A checker that silently
compares against the wrong thing is worse than a hard failure.

---

## The parity surfaces at a glance

Script-guarded rows fail `npm run upstream:check` or the icon check. The rest are hand-maintained
(drift is silent until you re-read Swift).

| # | What | Where it lives here | How drift is caught | Upstream source |
| - | --- | --- | --- | --- |
| 1 | Provider metadata (names, labels, dashboard/status URLs, brand colors) | `src/providers/index.ts` `PROVIDER_CATALOG` | `npm run upstream:check` | `Sources/CodexBarCore/Providers/**/…ProviderDescriptor.swift` |
| 2 | Dynamic usage-bar label overrides | `paceCapabilities.ts` `DYNAMIC_SLOT_TITLES`, or a module `displayTitle` | `npm run upstream:check` (id lists only, see Surface 2) | renderer files (see below) plus descriptor `primaryLabel` |
| 3 | Provider icons | `assets/provider-icons/*.svg` | `npm run upstream:sync-icons -- --check` | `Sources/CodexBar/Resources/ProviderIcon-<slug>.svg` |
| 4 | Usage meter: pacing eligibility and the lines under the bar | `paceCapabilities.ts`, `src/providers/meterDetail.ts` | `npm run upstream:check` | descriptor `pace:` and `ProviderMenuCardPresentation`, plus the watched menu-card files |
| 4b | Pacing, formula and labels | `usage/pacing.ts` | ❌ hand-maintained | `UsagePace.swift`, `UsagePaceText.swift` |
| 5 | Supplemental usage shapes | `usage/providerRules/` | ❌ hand-maintained | descriptor / snapshot shapes |
| 6 | CLI install routine (the app's Install CLI button) | `cli/install.ts` `installCodexBarCli` | ❌ hand-maintained | `Sources/CodexBar/PreferencesAdvancedPane.swift` |
| 7 | Hidden usage items | `usage/usageItemVisibility.ts`, read from Provider config | ❌ hand-maintained | `Sources/CodexBar/ProviderUsageItemVisibility.swift` |
| | Provider id aliases | module `aliases`, derived `PROVIDER_ID_ALIASES` | `npm run upstream:check` (collisions only) | `ProviderCLIConfig` (`cliName` plus aliases) |

Everything else the extension renders is derived, not tracked. Quota bars and usage meters use
`brandColor` in both appearances (`buildProgressPalette`). A Provider config `accentColor`
replaces `brandColor`. The menu bar uses `UsageMenuCardView.Model.progressColor`
(`ProviderAccentPalette.color`). The catalog value stays the shipped default that `upstream:check`
compares. Don't hand-edit derived values.

## Hidden usage items

`hiddenUsageItemIDs` on a Provider config entry is the app's list of menu-card items to hide
(`ProviderUsageItemID` in `ProviderUsageItemVisibility.swift`). The extension reads that list and
omits matching sections from the usage adornment and the detail view. The filter runs at render
time. The provider-detail cache still stores every section.

| Stored id | What it hides here |
| --- | --- |
| `metric:primary` / `metric:secondary` / `metric:tertiary` | That slot. |
| `metric:monthly` | Codex's 30-day lane (`CodexConsumerProjection.classifyRateWindow`, stamped by the Codex module). 300 minutes is `metric:primary`, 10080 is `metric:secondary`. Any other duration stays on its slot. |
| `metric:<extraRateWindow id>` | That named extra rate window (`cursor-grok-bot`, `codex-spark`, …). |
| `metric:code-review` | Codex code review. |
| `section:codex-reset-credits` | Limit Reset Credits. |
| `section:credits`, `detailSection:<raw title>` | That credits block or detail section, when the extension renders it. |

A presentation supplemental id `extra:<id>` matches `metric:<id>`. Cached details from before
`usageItemId` still match slot meters, Code review, and Limit Reset Credits by title. A named extra
window matches on the next fetch.

---

## Surface 1. Provider metadata (`upstream:check`)

`PROVIDER_CATALOG` in `src/providers/index.ts` holds one entry per provider id: `name`, `brandColor`,
`usageSectionLabels` (Primary/Secondary/Tertiary display titles, see CONTEXT.md "Display title"),
`dashboardUrl`, `subscriptionDashboardUrl`, `statusPageUrl`, `iconSlug`, and optional `iconFallback`.
Each provider keeps that metadata on `src/providers/<id>/index.ts`. `src/providers/index.ts`
lists those directories. The assembled catalog is built from `CATALOG_PROVIDER_ORDER` and the modules.
Every id comes from a module. A missing module throws. `upstream:check` fails when the index does not
match the directories. `registry.ts` is the Raycast adapter over that catalog
(icons, palettes, lookups). Helmcode's
catalog URL stays `https://cloud.helmcode.com/dashboard`, which is what the descriptor metadata
stores. The menu action uses `HelmcodeProviderDescriptor.dashboardURL(snapshot:)` and opens
`https://cloud.nan.builders/dashboard` when `identity.accountOrganization` is `NaN Builders`.
Helmcode's module `dashboardUrl` makes that switch from the payload organization.
`resolveDashboardUrl` uses the returned link as-is, including when it is undefined.

`npm run upstream:check` imports the catalog and diffs it against each upstream
`…ProviderDescriptor.swift`. It exits non-zero on:

- a provider present upstream but missing from the catalog (a new provider shipped)
- a provider in the catalog with no upstream descriptor (renamed or removed upstream)
- any field mismatch (`name`, the three labels, the URLs, `brandColor`)
- a stale `ALLOWED_DIVERGENCES` entry (see below)
- an unaccounted dynamic override (surface 2)

The catalog is imported as data, so reformatting it cannot hide a field. Upstream descriptors are
still parsed by regex over stable formatting. Descriptor fields are read from the
`ProviderMetadata(` literal (not an earlier `displayName:` in a validator) and branding colors
from `ProviderColor(red:green:blue:)` or `ProviderColor(hex: 0xRRGGBB)`. If a parser can no longer
find what it expects, it throws. A format change on the Swift side is a failure to fix, not a
silent gap.

### Providers the catalog does not list yet

An enabled Provider still renders when `PROVIDER_CATALOG` has no entry for its id
([ADR-0010](adr/0010-render-providers-missing-from-the-catalog.md)). Presentation meters keep the
CLI label. Raw slots use Primary / Secondary / Tertiary. The row uses a circle icon and `#22B8CF`,
or the config `accentColor`. Pace, dashboard, and status URLs wait for the catalog entry.
`upstream:check` still fails when upstream ships a provider the catalog lacks.

### `ALLOWED_DIVERGENCES`. Recording an intentional difference

Some upstream URLs are computed (`ZaiAPIRegion.global.dashboardURL.absoluteString`), not string
literals. The parser can't resolve a Swift expression, so it records it as `expr:<code>`. When ours
is a deliberately-resolved constant, record the pair in `ALLOWED_DIVERGENCES` (in
`scripts/check-upstream.mjs`) with `ours`, `upstream`, and a `reason`:

```js
zai: {
  dashboardUrl: {
    ours: "https://z.ai/manage-apikey/coding-plan/personal/my-plan",
    upstream: "expr:ZaiAPIRegion.global.dashboardURL.absoluteString",
    reason: "upstream computes the URL per region; ours is the resolved .global constant",
  },
},
```

The allowance suppresses only that exact pair. If either side moves, including into agreement,
the entry is reported stale and must be re-reviewed and updated or deleted. It cannot sit around
as a blanket exemption. When upstream changes a computed URL, you re-resolve the constant by hand
and update `ours`. The stale-entry failure is what tells you to.

## Surface 2. Dynamic usage-bar label overrides

Static labels live in `usageSectionLabels`. On top of them, upstream's renderers relabel some bars
from payload contents. We port these into `DYNAMIC_SLOT_TITLES` (`paceCapabilities.ts`).
`normalize.ts` applies that map, then falls back to the catalog's static label:

- **codex.** Titles follow window length (`CodexConsumerProjection.rateTitle`, on the Codex
  module). 5-hour becomes Session, 7-day becomes Weekly, 30-day becomes Monthly.
- **factory.** Switches to 5-hour / Weekly / Monthly whenever a tertiary window is present.
- **grok.** Relabels its primary bar by billing-window length (`windowMinutes`, else the distance to
  `resetsAt`). Untyped windows with only `resetsAt` fall back to "Weekly" (`displayLabel`, #2929).
- **doubao.** Relabels a windowless "requests"-style primary as "Requests".
- **amp.** An "Agent" detail row relabels primary as "Agent usage". Dual-window accounts become
  "Other usage" / "Orb usage". A lone primary without Agent keeps "Amp Free".
- **alibabatokenplan.** A 5-hour primary becomes "5-hour", a 7-day secondary becomes "7-day".
- **sub2api.** A present secondary window relabels primary as "Daily quota". MenuCardView shortens
  secondary/tertiary. We keep the descriptor's Weekly quota / Monthly quota.
- **ollama.** A monthly-sentinel primary becomes "Monthly".
- **mistral.** A present primary window is labeled "Included API" (`rateWindowLabeler`).
- **qwencloud.** A 30-day primary becomes "Monthly" (`rateWindowLabeler`).
- **stepfun.** A primary with no secondary window is labeled "Credit" (`rateWindowLabels`).

`upstream:check` scans the renderer files for override call sites, plus any descriptor that
defines `primaryLabel` or sets `rateWindowLabeler:`, and cross-checks them against
`DYNAMIC_SLOT_TITLES` and `UNPORTABLE_DYNAMIC_TITLES` in `paceCapabilities.ts` (imported, the same
map `normalize.ts` uses). A module `displayTitle` replaces that id, and the table entry is not
also used. `cursor` is unportable. MenuCardView keys on
`snapshot.detailRow(label: "Request quota")`, which the CLI JSON does not expose.

A green check means every scanned id is a module `displayTitle`, a `DYNAMIC_SLOT_TITLES` key, or an
unportable entry. Presentation meters (`schemaVersion === 1`) still use the CLI's `meter.label` and
never call `resolveDynamicSlotTitle`. If upstream adds a dynamic override, the check fails until
you add a module `displayTitle`, a map entry, or mark it unportable.

The renderer files scanned are pinned in `RENDERER_PATHS`:

```
Sources/CodexBar/MenuDescriptor.swift
Sources/CodexBar/MenuCardView+ModelHelpers.swift
Sources/CodexBar/UsageStore+WidgetSnapshot.swift
Sources/CodexBarCLI/CLIRenderer.swift
Sources/CodexBarCLI/DashboardSnapshotBuilder.swift
```

A renamed or deleted file fails on read. A brand-new renderer file is the one blind spot. It is
invisible until someone adds it here. If upstream introduces a new file that renders usage-bar
titles, add its path to `RENDERER_PATHS`. The scan is a heuristic (regex, not a Swift parser).
Its known limitations are commented in `parseDynamicOverrideProviders`.

## Surface 3. Provider icons (`upstream:sync-icons`)

Every catalog `iconSlug` maps to `assets/provider-icons/<slug>.svg`, harvested from upstream's
`Sources/CodexBar/Resources/ProviderIcon-<slug>.svg`.

- `npm run upstream:sync-icons` fetches, optimizes with SVGO, normalizes the root to
  `width/height="100"` while keeping `viewBox`, writes changed icons, and deletes a local SVG whose
  slug is no longer in the catalog.
- `npm run upstream:sync-icons -- --check` does the same comparison but writes nothing and exits
  non-zero if an icon is out of date or a local SVG has no catalog `iconSlug` pointing at it.
- `npm run upstream:prune` removes every catalog Provider that no longer has an upstream descriptor.
  It deletes `src/providers/<id>/`, rewrites `src/providers/index.ts`, and drops the id from
  `CATALOG_PROVIDER_ORDER` and the upstream allowlists (`CUSTOM_PACE_RULES`, `ALLOWED_DIVERGENCES`,
  `UNPORTABLE_PRESENTATION_PACE`, `UNPORTABLE_HEADROOM_HINT`, `UNPORTABLE_DYNAMIC_TITLES`).
  `assets/provider-icons/<slug>.svg` is deleted only when no remaining Provider's `iconSlug` uses it.
  A quoted id, a `providers/<id>` or `providerRules/<id>` path, or a `/<id>/` URL in production
  code that would survive the edit blocks the write, so the catalog row is still there on the next
  run. A test that mentions the id is printed and left in place. `--check` reports the removals
  and writes nothing. `npm run upstream:bump` writes the lock only after this prune, `npm run typecheck`,
  and `npm test`. See [ADR-0011](adr/0011-fail-closed-provider-prune.md).

Icons are tinted `Color.PrimaryText` at render time, so upstream's own fills don't matter. The
geometry does. SVGO runs `preset-default` plus `removeScripts` before compare/write. Slugs that
contain `..`, a leading `/`, or a path separator fail the script.

## Surface 4. Usage meter (`upstream:check`)

A usage meter is Primary, Secondary, Tertiary, or an extra rate window. Pacing eligibility and the
lines under the bar both live here. The shared pace formula and its wording stay on Surface 4b.

Eligibility lives in [`paceCapabilities.ts`](../src/providers/paceCapabilities.ts), a table that
mirrors each descriptor's `pace: ProviderPaceCapability(...)`. `computeMeterPacing` in
`normalize.ts` evaluates that table the way the app menu card does, not the CLI's `resolvedKind`.
Those two disagree for some providers. The GUI wins.

- **The formula.** `calculateUsagePacing` in [`usage/pacing.ts`](../src/usage/pacing.ts),
  mirroring `UsagePace.swift`. Session default 300 minutes, weekly default 10_080. Calendar-month
  sentinels (43_200) are expanded to the real month via `inferredMonthlyWindowMinutes`. Not
  compared by `upstream:check`.
- **Gating.** `sessionPaceWindowRule` on primary (and Kimi's secondary), else `resetWindowPace`.
  Secondary (not tertiary) then uses the generic weekly rule (`windowMinutes` required except Codex
  via `secondaryAllowsDefaultWindow`). Named extra rate windows use `resolveExtraWindowPace`
  (Codex, Claude, Antigravity, Cursor. 300-minute extras as session except Claude and Cursor,
  10080 as weekly). OpenCode Go sets `allowsEstimatedUsage: false`, so estimated local-cost
  snapshots skip every pace marker.
- **Labels.** `formatUsagePacingLabels` in `usage/pacing.ts`. Not compared by `upstream:check`.

`upstream:check` imports `PACE_CAPABILITIES` and diffs the GUI fields (`resetWindowPace`,
`inferredMonthlyDuration`, `sessionPaceWindowRule`, `allowsEstimatedUsage`) against each
descriptor `pace:` argument. A module `pace` replaces that id's table row. With neither, pace is
unsupported. `extraWindowPace` on the module (`session-or-weekly` or `weekly-only`) replaces
membership in `EXTRA_WINDOW_PACE_PROVIDER_IDS` and `WEEKLY_ONLY_EXTRA_WINDOW_PROVIDER_IDS`.
`secondaryAllowsDefaultWindow` is TypeScript-only, not a Swift `pace:` field. A unit test in
`paceCapabilities.test.ts` pins it to Codex.
CLI `resolvedKind` lanes are parsed so an unknown field still throws, but they are not compared.
`.custom { ... }` closures are Swift fingerprints in `CUSTOM_PACE_RULES`. `Self.foo` wrappers are
inlined. An unknown custom, a changed body, or a new `pace:` on a previously-unsupported provider
fails the check. Notion's rolling-session closure (`minutes <= 360`) and Ollama's five-hour
closure (`minutes <= 300`) are not named ids: that fingerprint resolves to `windowDurationAtMost`.
Claude's always-true session closure (`_, _ in true`) resolves to `{ type: "always" }`
(`matcher: "always"`).
Amp, Codex, Z.ai, and Grok closures resolve to the predicate on that module pace field
(`matcher: "predicate"`, same id). The pace engine calls the function. A different body still fails.
Presentation-only paths (`usesAbacusPace`, `usesSyntheticRollingRegen`), Codex
`showsHeadroomHint` (`UNPORTABLE_HEADROOM_HINT`), secondary `sessionPaceDetail` in
`secondaryMetric`, and `extraRateWindowPaceDetail` provider names are scanned the same way
dynamic labels are.

Do not session-pace OpenCode Go's 5-hour primary. `sessionPaceWindowRule` is `.unsupported` in
the GUI even though the CLI `resolvedKind` lane would allow it. Antigravity session pace is
`.windowDuration(minutes: 300)`. A primary with no `windowMinutes` is not session-paced.

### One deliberate divergence we keep

**Tick geometry.** Upstream's pace tip is a Canvas three-stripe punch (`UsageProgressBar.swift`).
We keep a simple 3×12 rounded rect. We punch a transparent gutter through the bar around that tick
so the color stays readable on similar brand fills. Color and hide-when-on-pace match the app.
Deficit is SwiftUI `Color.red`, reserve is `Color.green`.

### Out of scope. Not the plain pace marker

Abacus billing-cycle copy and Synthetic rolling-regen detail are listed in
`UNPORTABLE_PRESENTATION_PACE`. Codex `showsHeadroomHint` (1.5×) is listed in
`UNPORTABLE_HEADROOM_HINT`. Workday-aware pacing and historical run-out probability are not
implemented.

### Lines under the bar

`meterLines` in [`usage/normalize.ts`](../src/usage/normalize.ts) fills every usage meter from
[`meterDetail.ts`](../src/providers/meterDetail.ts). Schema 1 meters use that same function. A
supplemental meter that is not an extra rate window gets neither line. The list adornment ignores
both strings. Pacing is applied when the card draws the meter: it replaces `detailLeftText` and
keeps `detailText` on the next line. Regen stays under those.

Primary, in the app's order:

1. `.reset` copies that window's `resetDescription` to the title row when the window has no countdown.
2. `.detail` copies it to `detailText`. `.detailLeft` copies it to `detailLeftText`.
3. `showsPrimaryBalanceDescription` copies it to `detailText`.
4. `.poeBalance` writes `detailText` from the text after `Balance:` on `loginMethod`. `.kiroCredits`
   writes `detailLeftText` as `X of Y credits left` and skips a zero total.
5. `clearsPrimaryReset` or `hidesPrimaryResetWithoutDate` drops `resetText` when the window has no countdown.

Secondary: weekly pacing is computed first. Kimi's secondary stays on the session rule in
`paceCapabilities.ts`. `secondaryDetailText` or `showsSecondaryBalanceDescription` then sets
`detailText`. `showsSecondaryBalanceDescription` clears the countdown when the window has no date.
`secondaryReplacesPace` sets `detailLeftText` and `replacesPace`, the local mark for upstream setting
`pacePercent` to nil. At render, a reset-window forecast still wins when the section is secondary,
`replacesPace` is set, and `usagePacing` is present for a window `resetWindowPace` matches. An
ordinary weekly forecast does not. That is `secondaryMetric` applying `resetWindowPaceDetail` after
the Copilot and Zenmux branch. `usagePacing.context` is `window` for both, so the card reads
`paceCapabilities.ts` instead of the pacing object.

Tertiary: `tertiaryDetailText` sets `detailText`. The shared line is the reset-window pace forecast
when the pace table has one.

Extra rate window: `extraResetDescriptionAsDetail` copies `resetDescription` to `detailText` and
drops the countdown when the window has no date. `true` is every extra window (Sub2API's
`{ _ in true }`). A string is that window id (`mistral-monthly-plan`). Any other closure stays in
`UNPORTABLE_MENU_CARD`. The `kiro-overage` window sets `detailLeftText` to `X of Y credits left`
from Overage credits left and the `of …` prefix on Overage usage, and that text replaces the pace
line. Skip when a piece is missing. Other extras keep the pace line they already have.

These ids are not on the descriptor. They are `MenuCardView` branches, kept as named sets in
`scripts/lib/meter-detail.mjs`, so a drift in the Swift list still requires the `menuCardReviewed` pin:

- `secondaryDetailText`: Warp, Alibaba, Alibaba Token Plan. Warp also clears the secondary countdown
  when the window has no supplied reset text. The CLI JSON does not carry `suppliedResetText`, so
  Warp's secondary countdown is cleared whenever that detail line is present.
- `secondaryReplacesPace: "resetDescription"`: Copilot, Zenmux. Zenmux also sets
  `secondaryHidesResetWithoutDate`.
- `secondaryReplacesPace: "kiroBonusCredits"`: Kiro. The total is the text before `·` on Bonus
  credits left, with a leading `of ` removed. Skip when either piece is missing.
- `tertiaryDetailText`: Alibaba, Alibaba Token Plan, from that window's `resetDescription`.
- `extraDetailLeft: "kiroOverage"`: the `kiro-overage` extra window.

`.standard` and `.none` are omitted from the table. `.requestQuota` stays in `UNPORTABLE_MENU_CARD`
because the CLI JSON does not expose that row. A non-default `usageNotesResolver` or
`primaryDescriptionIsDetail` closure stays there until an entry names it. `primaryDescriptionIsDetail`
is the menu descriptor, not the card, including Raycast's `{ _ in true }`.

`codexbar-upstream.lock` keeps the review pin on `menuCardReviewed`. The watched paths are:

- `Sources/CodexBar/MenuCardView.swift`
- `Sources/CodexBar/MenuCardView+ModelHelpers.swift`
- `Sources/CodexBar/MenuCardMetricRow.swift`
- `Sources/CodexBarCLI/CLIRenderer.swift`
- `Sources/CodexBarCore/Resources/Plugins/`

`upstream:check` diffs the pinned lock sha against the candidate. A changed watched path fails
the check until `menuCardReviewed.sha` is the candidate and the path is listed. A plugin change
names the file, such as `raycast.js`.

DeepSeek localizes `detailText` in the app. The extension shows the CLI's English text. Providers
absent from the table keep `resetDescription` as a pace hint (Devin "Daily", Z.ai "MCP", Amp
"renews in …").

## Codex-only raw projection. Weekly caps session

On the raw usage path (no `presentation.schemaVersion === 1` meters), Codex applies the app's
`CodexConsumerProjection.weeklyCapsSession` rule in `src/providers/codex/usageCard.ts`. When weekly
remaining is 0 and still binding, Primary is forced to 0% remaining and its reset is retargeted via
`bindingReset`. The reset it reads is the section's `resetsAt`.
Presentation meters stay authoritative (ADR-0005). The cap is not re-applied on that path.

## Surface 5. Supplemental usage shapes (hand-maintained)

Beyond Primary/Secondary/Tertiary, upstream models a long list of provider-specific meters. We map a
few special cases:

- **Mapped.** Codex's "Code review" allowance (`codeReviewRemainingPercent`, on the Codex
  provider module), named extra rate windows (`extraRateWindows`, e.g. "Codex Spark"), and
  OpenRouter key usage (`openRouterUsage`, on the OpenRouter provider module).
  Antigravity extras whose ids start with `antigravity-quota-summary-` are what the detail card
  draws (on the Antigravity provider module). Primary and Secondary are copies for the list
  adornment, the same rule as `antigravityMetrics` in `MenuCardView+ModelHelpers.swift`. Skip
  the slot-hiding rewrite when presentation meters are already present.
- **Recorded, not rendered.** A Raycast card with a zero total has no meter. The bundled plugin
  sends Left and Total rows and a `Renews:` note (`Sources/CodexBarCore/Resources/Plugins/raycast.js`).
  Those rows stay off the card. Raycast's `detailText` is the CLI `resetDescription`. `upstream:check`
  names `raycast.js` when that plugin changes.
- **Deferred / unmapped.** `cursorRequests`, `zaiUsage`, `minimaxUsage`, `kiroUsage`, `mistralUsage`,
  `deepseekUsage`, `deepgramUsage`, `openAIAPIUsage`, `claudeAdminAPIUsage`, `antigravityPlanInfo`.
  These wait until we can sample their live JSON. An unmapped shape renders nothing, silent by
  design, so mapping one requires a real payload to key against, not a guess. See the
  `Supplemental usage` entry in [`CONTEXT.md`](../CONTEXT.md).
  Also unmapped: Kimi's `blockingQuota` on the `kimi-monthly` extra
  window (shorter meters show "Blocked by monthly limit" and drop their reset and pace), Claude
  limit-reset credits (`ClaudeRateLimitResetCredits`, on the app menu and on serve `usage.details`),
  and Muse's estimated-quota note for a selected dev.meta.ai team.

## Surface 6. CLI install routine (hand-maintained)

When the CodexBar CLI is missing but the CodexBar app is installed, the extension can set up the
app's bundled CLI itself (ADR-0008). `installCodexBarCli` in
[`cli/install.ts`](../src/cli/install.ts) is a port of the app's own Install CLI
button, `installCLI()` in `Sources/CodexBar/PreferencesAdvancedPane.swift`. This is the first place
the extension mirrors upstream behaviour rather than payload interpretation. The properties that
must survive any edit:

- Tries both `/usr/local/bin/codexbar` and `/opt/homebrew/bin/codexbar`, in that order,
  best-effort. Partial success is a normal outcome, not first-writable-wins.
- Never overwrites an existing destination (no `ln -sf`). A foreign file is reported (`Exists:`)
  and left alone.
- No `mkdir`. A missing prefix is skipped without a result entry, which is how
  `No writable bin dirs found.` is reached. No privilege escalation. A non-writable dir is
  reported, never sudo'd. The repo script `bin/install-codexbar-cli.sh` does escalate. We follow
  the GUI, not the script.
- The result strings are upstream's, verbatim: `Installed: {dir}` · `Exists: {dir}` ·
  `No write access: {dir}` · `Failed: {dir}` · `No writable bin dirs found.` ·
  `CodexBarCLI not found in app bundle.`

When re-verifying, re-read `installCLI()` and its `isLink` helper in
`PreferencesAdvancedPane.swift`. [`cli/install.test.ts`](../src/cli/install.test.ts) pins each
property against real temp dirs, but only Swift says whether the algorithm itself moved.

## Provider id aliases (hand-maintained)

The CLI accepts alternate spellings for a provider id (its `cliName` plus upstream aliases from
`ProviderCLIConfig`, e.g. `alibaba-coding-plan` → `alibaba`, `groqcloud` → `groq`). Each provider
module lists its `aliases`. `PROVIDER_ID_ALIASES` in `src/providers/index.ts` is derived from those
lists and resolves each spelling to the canonical id, the upstream enum case name, which is what
`config.json` and the payloads use. A config listing either spelling renders one row. When
upstream adds an alias, add it on the module, or a user's config that uses the new spelling falls
through to the title-cased fallback row. `upstream:check` fails if two modules share one, or if an
alias equals any provider id. That check does not compare the spellings to upstream.

---

## Worked example. Catching a new `pace:` row

Session and reset-window eligibility used to be a hand-maintained whitelist. That drifted. Grok
grew a weekly pacer. Cursor, Copilot, Kimi, Zai, and Notion already had descriptor rules we were not
running. The table is now `PACE_CAPABILITIES`, and `upstream:check` diffs it against every
descriptor.

When the check fails:

1. Read the descriptor `pace:` block. Parseable GUI fields (`windowDurationPresent`,
   `.calendarMonthResetWindow`, …) go on the module `pace`. A `.custom { }` needs a
   `CUSTOM_PACE_RULES` fingerprint of the Swift body. An always-true
   closure (`_, _ in true`) is `{ type: "always" }` with `matcher: "always"`. A closure that only
   accepts a present duration of at most N minutes can be `windowDurationAtMost` instead, with
   `matcher: "windowDurationAtMost"` on that fingerprint. A module predicate uses
   `matcher: "predicate"` and the same id; the module's `matches` function is what runs.
   CLI `resolvedKind` lanes stay out of the table.
2. `computeMeterPacing` already evaluates the table. Add a gating test in
   [`normalize.test.ts`](../src/usage/normalize.test.ts) for the new rule.
3. Give the mock a window that actually satisfies it (reset inside the duration, enough elapsed
   for `idealUsedPercentByNow ≥ 3%`). See [`cli/mockPayloads.ts`](../src/cli/mockPayloads.ts).

Do not infer "has a 5-hour primary" from the payload. OpenCode Go is the reminder. The CLI lane
would session-pace that bar. The GUI `sessionPaceWindowRule` would not.
