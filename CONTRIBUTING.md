# Contributing

Thanks for helping improve the CodexBar Raycast extension. This page explains where to report bugs, where to propose ideas, and where to send code.

The CodexBar Raycast extension lives in two places:

- **The CodexBar Raycast extension repository**, [raulgg/raycast-extension-codexbar](https://github.com/raulgg/raycast-extension-codexbar). This is where the CodexBar Raycast extension is developed and where discussions happen.
- **The Raycast extensions repository**, [raycast/extensions](https://github.com/raycast/extensions), under `extensions/codexbar`. This is what the Raycast Store publishes.

The maintainer keeps the two in sync. You may be reading this file from either of them, or from a local copy, so every instruction below names the repository it refers to.

## Where things go

| I want to...                           | Do this                                                                                                                                                                                                                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Report a bug                           | Open an issue in the [CodexBar Raycast extension repository](https://github.com/raulgg/raycast-extension-codexbar/issues)                                                                                                                                                                    |
| Propose a feature or discuss an idea   | Open an issue in the [CodexBar Raycast extension repository](https://github.com/raulgg/raycast-extension-codexbar/issues) before writing code                                                                                                                                                |
| Submit code                            | Open a pull request in the [CodexBar Raycast extension repository](https://github.com/raulgg/raycast-extension-codexbar) **or** directly in the [Raycast extensions repository](https://github.com/raycast/extensions). Both are fine. See [Sending code](#sending-code).                    |
| Report wrong usage numbers or CLI bugs | Open an issue in the [CodexBar repository](https://github.com/steipete/CodexBar/issues). The CodexBar Raycast extension only runs the `codexbar` CLI; the CLI fetches every provider's usage.                                                                                                |
| Ask for a provider the CLI lacks       | Open an issue in the [CodexBar repository](https://github.com/steipete/CodexBar/issues). Once the CodexBar app ships a provider, open an issue in the CodexBar Raycast extension repository (or a pull request following [docs/upstream-parity.md](docs/upstream-parity.md)) to map it here. |

> **Status.** The CodexBar Raycast extension is not in the Raycast Store yet, so there is no `extensions/codexbar` directory in the Raycast extensions repository for now. Until the first release lands, everything goes through the CodexBar Raycast extension repository.

## Discuss ideas first

Please open an issue in the [CodexBar Raycast extension repository](https://github.com/raulgg/raycast-extension-codexbar/issues) before building a new feature or changing behavior. Small bug fixes and upstream-parity updates do not need one.

Why: this extension deliberately mirrors the [CodexBar macOS app](https://github.com/steipete/CodexBar) — parity with upstream beats local invention, and new surfaces or features the app does not have are usually declined (see [AGENTS.md](AGENTS.md), "Scope"). Raycast also will not merge significant changes to an extension without the author's sign-off, so agreeing on the idea first means your pull request will not stall in review. It settles whether the change belongs in the extension or in CodexBar itself, and lets the maintainer point you at the relevant notes in [docs/maintaining.md](docs/maintaining.md), [docs/upstream-parity.md](docs/upstream-parity.md), and [docs/adr/](docs/adr/) before you start.

You can also open issues in the Raycast extensions repository (Raycast labels them per extension), but the CodexBar Raycast extension repository is preferred so discussions stay in one place.

## Sending code

You are not required to open your pull request in the CodexBar Raycast extension repository. Pick whichever suits you:

**Directly in the Raycast extensions repository.** Follow Raycast's [Contribute to an Extension](https://developers.raycast.com/basics/contribute-to-an-extension) guide: use the **Fork Extension** action in Raycast (or a [sparse checkout](https://developers.raycast.com/information/developer-tools/forked-extensions), since the Raycast extensions repository is very large), run `npm install && npm run dev` inside `extensions/codexbar`, then open a pull request against `raycast/extensions` `main`. The maintainer is pinged automatically as code owner, reviews it there, and syncs the merged change back into the CodexBar Raycast extension repository. This path gives you full credit: you are the pull request author, which is what Raycast's contributor credits are based on.

**In the CodexBar Raycast extension repository.** Fork [raulgg/raycast-extension-codexbar](https://github.com/raulgg/raycast-extension-codexbar), branch from `main`, run `npm ci` and `npm run dev` from the repository root. After review and merge, the maintainer publishes the change to the Raycast extensions repository. Because Raycast's publish tooling opens that pull request from the maintainer's account, your credit is preserved in the commit: you are recorded as the commit author, or as co-author (`Co-authored-by:`) when several people contributed, so the change shows up on your GitHub profile and in the history of the Raycast extensions repository. Raycast's own contributor credits, however, go to whoever opens the pull request in the Raycast extensions repository. If that matters to you, use the direct path above, or run `npm run publish` from your own clone of the CodexBar Raycast extension repository once your change is merged there; that opens the Raycast pull request under your account.

In both repositories:

- `npm run dev` loads the CodexBar Raycast extension into Raycast from the directory you run it in and reloads on changes. You need macOS, Raycast, and the [CodexBar CLI](https://github.com/steipete/CodexBar) (`codexbar`) installed to exercise the commands end to end. Without a configured CLI, set `DEV_MOCK = true` in `src/mocks/codexbar.ts` for fake payloads (development builds only) and revert it before committing.
- Read [docs/maintaining.md](docs/maintaining.md) for the repo layout, everyday commands, and runtime quirks; [docs/upstream-parity.md](docs/upstream-parity.md) before touching provider metadata, pacing, or icons; [CONTEXT.md](CONTEXT.md) for the vocabulary the code and UI copy use; and [docs/adr/](docs/adr/) for the accepted trade-offs. All of them ship alongside this file in either repository. If you contribute with an AI coding agent, it should read [AGENTS.md](AGENTS.md) first.
- Never hand-edit provider entries in `src/providers/registry.ts` or redraw files in `assets/provider-icons/`. They are synced from upstream by `npm run upstream:check` and `npm run upstream:sync-icons`. When upstream removes a provider, `npm run upstream:prune` deletes the catalog entry, aliases, mocks, pace rows, dynamic titles, the provider-rules file, and the SVG. It leaves call sites and tests in place and exits non-zero while anything else still names that provider. Transcribe new catalog values from the upstream Swift descriptors and name the upstream file and SHA you verified against in your pull request.
- Update [CHANGELOG.md](CHANGELOG.md) with a `## [Title] - {PR_MERGE_DATE}` entry. Raycast fills in the date on release.
- Add your Raycast Store handle to `contributors` in `package.json`. This is the credit shown on the Store page, and it makes you a code owner for future changes.
- Say what you tested against a real setup (CodexBar CLI or app version, macOS version, which providers you have configured). Automated tests stub Raycast and the CLI, so they cannot prove what a live `codexbar` payload looks like.
- Run the checks before opening the pull request:

```sh
npm test
npm run lint
npm run upstream:check
npm run upstream:sync-icons -- --check
npm run build
```

CI runs `ray lint`, which pins its own Prettier version. Fix formatting with `npm run fix-lint`, not a locally installed prettier.

Commit messages use a light conventional style (`fix:`, `feat:`, `docs:`, `refactor:`, `test:`, `chore:`) with a short imperative summary. A `(codexbar)` scope is common in this repository's history but optional.

## How sync works

For the maintainer, and for anyone curious why both paths are safe.

- **From the Raycast extensions repository to the CodexBar Raycast extension repository.** When a pull request touching `extensions/codexbar` merges in `raycast/extensions`, the maintainer runs `npx @raycast/api@latest pull-contributions` on `main` of the CodexBar Raycast extension repository. It brings the upstream changes in as a single `Pull contributions` commit; conflicts are resolved with `git add` and `git merge --continue`. If the CLI cannot fast-forward, the fallback is `git format-patch -1 <merge-commit> -- extensions/codexbar` from a sparse checkout of `raycast/extensions`, applied at the root of the CodexBar Raycast extension repository with `git am -p3`.
- **From the CodexBar Raycast extension repository to the Raycast extensions repository.** The maintainer runs `pull-contributions` first, then `npm run publish` from the root of the CodexBar Raycast extension repository. That pushes the extension to the `ext/codexbar` branch of the maintainer's fork of `raycast/extensions` and opens or updates the pull request there. Contributors are credited as commit author or co-author, in `CHANGELOG.md`, and in `contributors`.
- Automating this (mirroring pull requests merged in the CodexBar Raycast extension repository to `raycast/extensions` with the contributor as commit author) is on the list to research. Until then it is a manual step, so there can be a short delay between a merge in the CodexBar Raycast extension repository and the Store release.

## Ground rules

- The CodexBar Raycast extension runs the `codexbar` CLI (or its `serve` daemon) and renders what it returns. It never fetches a provider's API or status page itself. Anything that needs new data starts in the [CodexBar repository](https://github.com/steipete/CodexBar).
- Wording, pacing semantics, provider metadata, and icons track the CodexBar macOS app. When the extension and the app disagree, the app wins; record intentional divergences where [docs/upstream-parity.md](docs/upstream-parity.md) says to.
- Use the vocabulary in [CONTEXT.md](CONTEXT.md) (Provider, reset window, pacing, supplemental usage, …) in code, UI copy, and docs. Avoid the synonyms it lists.
- Do not reverse an accepted decision in [docs/adr/](docs/adr/) silently. Propose a new ADR in your pull request instead.
- Keep command names, entrypoint filenames, and preference keys stable; users have shortcuts and settings bound to them.
- Raycast's [Store guidelines](https://developers.raycast.com/basics/prepare-an-extension-for-store) and [Community Guidelines](https://manual.raycast.com/community-guidelines) apply to every change, in either repository.

Contributions are licensed under the [MIT License](LICENSE), like the rest of the project.
