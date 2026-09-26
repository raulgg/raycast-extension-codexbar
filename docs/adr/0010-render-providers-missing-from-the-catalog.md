# Enabled Providers render before the catalog lists them

The Usage Overview lists every enabled, non-selector Provider from `~/.codexbar/config.json`
([ADR-0001](0001-shared-codexbar-config.md)), and reorder swaps those same neighbors. Catalog
membership supplies the brand icon, brand color, static display titles, pacing, and dashboard /
status URLs. A missing entry uses the title-cased id, a circle icon, `#22B8CF` or the config
`accentColor`, and the CLI meters ([ADR-0005](0005-gui-parity-usage-contract.md)) with no pace
footer. `npm run upstream:check` still requires the catalog entry.
