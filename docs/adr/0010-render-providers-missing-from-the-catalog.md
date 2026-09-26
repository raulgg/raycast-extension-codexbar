# Enabled Providers render before the catalog lists them

The Usage Overview reads enabled Providers from `~/.codexbar/config.json`
([ADR-0001](0001-shared-codexbar-config.md)). A newer CodexBar app can enable a Provider this
extension's catalog does not list yet. Hiding that row until the next catalog sync drops usage the
CLI already returns. Skipping the row when reordering swaps its neighbors across it in the shared
file.

Decision: every enabled, non-selector Provider id is listed and reorderable, whether or not
`PROVIDER_CATALOG` contains it. The CLI payload supplies the meters
([ADR-0005](0005-gui-parity-usage-contract.md)). Catalog membership supplies the brand icon, brand
color, static display titles, pacing rules, and dashboard / status URLs. A missing entry uses the
generic fallback: a title-cased name, a circle icon, fill `#22B8CF` unless the config entry has an
`accentColor`, and no pace footer. `npm run upstream:check` still requires the catalog entry when
the pin moves.
