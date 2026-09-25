# CodexBar Changelog

## [Initial Version] - {PR_MERGE_DATE}

- Usage Overview keeps working after Raycast restores its cached CodexBar CLI check
- Extension icon matches the official CodexBar app icon
- Usage meters and list quota bars use a Provider's accent color from `~/.codexbar/config.json` when the CodexBar app has customized it
- Antigravity detail hides Gemini Models and Claude and GPT when quota-summary extras are present
- Refresh Usage Cache runs every 10 minutes and requests a live serve copy (`refresh=true`)
- Usage Overview does not start serve or enable the background command. If serve is down it uses a one-shot CLI fetch
- CodexBar serve daemons started by background refresh use a 10-minute response cache TTL
- Usage overview for every provider the CodexBar CLI supports (69 provider ids matching CodexBar v0.60.4, with alias resolution and shared `~/.codexbar/config.json` ordering)
- OpenRouter dashboard opens Activity; Amp, Ollama, OpenCode Go, and Cursor extra-window pacing match CodexBar v0.60.4
- Grok weekly credits window shows the same pace marker as the CodexBar app
- Pace ticks use the CodexBar app's red (deficit) and green (reserve) colors, and hide when a window is on pace
- Pace ticks punch a gap through the usage meter so the color stays visible on similar brand fills
- Detail usage meters put remaining percent and the reset countdown on the title row, with pacing as one line under the bar
- Cursor, Copilot, Kimi, Zai, Notion, and calendar-month providers (Alibaba, Amp, Command Code, Doubao, MiMo, OpenCode Go, StepFun) show the same plain usage pacer as the CodexBar app
- Codex, Claude, and Antigravity extra rate windows show the same session and weekly pacer as the CodexBar app
- `npm run upstream:check` diffs each provider's `pace:` capability against `paceCapabilities.ts` so a new upstream pacer fails the check instead of drifting silently
- `npm run upstream:sync-icons -- --check` fails when leftover SVGs remain under `assets/provider-icons/`
- `npm run upstream:check` pins CodexBar to `codexbar-upstream.lock` and imports `catalog.ts` / `paceCapabilities.ts` instead of regex-parsing `registry.ts`
- Background refresh restarts the CodexBar serve daemon when it predates the installed CLI binary, so payload shapes stay consistent across app updates
- Usage payloads that nondeterministically omit supplemental sections (e.g. Claude's scoped extra rate windows) are repaired from a per-provider section memory, keeping meter sets stable across refresh paths
- When the CodexBar CLI is missing but the CodexBar app is installed, the extension offers to set up the app's bundled CLI itself after an explicit confirmation — a faithful mirror of the app's own Install CLI button (never overwrites existing files, never asks for a password)
- Without the app, the install help lays out both routes (CodexBar app + CLI, or CLI only) and adapts the instructions to whether Homebrew is installed
- Detail view with usage meters, pacing, named extra rate windows, Codex code-review and limit-reset-credit meters, and OpenRouter balance/key usage; account email and plan in the header
- Hide Personal Information preference that hides the account email in the detail header
- Optional strict, Provider-wide Keychain isolation for every CodexBar process the extension launches, including policy-scoped Provider caches and graceful background daemon reconciliation
