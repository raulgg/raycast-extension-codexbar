# A removed Provider is deleted as a directory

`npm run upstream:prune` deletes `src/providers/<id>/`, regenerates `src/providers/index.ts`, and drops that id from the catalog order and the upstream allowlists. An icon file is deleted only when no remaining Provider uses its slug. A quoted id, module path, or URL segment that would survive that edit blocks the write, so the catalog row is still there on the next run.

`npm run upstream:bump` writes `codexbar-upstream.lock` only after that prune, `npm run typecheck`, and `npm test`. `upstream:check` does not typecheck. A failed typecheck or test restores the prune. The statement rewriter that used to edit call sites is gone: a leftover reference is a person's edit.
