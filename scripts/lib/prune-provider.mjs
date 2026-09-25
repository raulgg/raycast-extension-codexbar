// Deletes one provider that upstream no longer ships: catalog entry, aliases, mocks,
// pace rows, dynamic titles, allowlists, the provider-rules module, icons, and tests
// that only mention that provider. Shared tests that use the id as one sample among
// several are left in place.

import {
  countIdentifiers,
  editNamedObject,
  editNamedSet,
  literalLocations,
  removeArrayElements,
  removeImportSpecifiers,
  removeImportsFrom,
  removeUnionMember,
  replaceProviderTernary,
  transformSource,
} from "./ts-text.mjs";

const CATALOG = "src/providers/catalog.ts";
const PACE = "src/providers/paceCapabilities.ts";
const MOCKS = "src/cli/mockPayloads.ts";
const CHECK = "scripts/check-upstream.mjs";

export function providerRulesPath(id) {
  return `src/usage/providerRules/${id}.ts`;
}

export function isTestPath(filePath) {
  return /\.test\.(tsx?|mjs)$/.test(filePath);
}

function exportedBindings(source) {
  const names = new Set();
  for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s+(?:const|class|type|interface|enum)\s+([A-Za-z0-9_]+)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of match[1].split(",")) {
      const piece = part.trim();
      if (!piece) continue;
      const name = piece.split(/\s+as\s+/).pop()?.trim();
      if (name && /^[A-Za-z0-9_]+$/.test(name)) names.add(name);
    }
  }
  return [...names];
}

function customIdsIn(text) {
  return [...text.matchAll(/\bid:\s*["']([A-Za-z0-9_]+)["']/g)].map((match) => match[1]);
}

function bareIdentifier(value) {
  const trimmed = value.trim();
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(trimmed) ? trimmed : undefined;
}

function editObject(source, name, shouldRemove) {
  return editNamedObject(source, name, shouldRemove);
}

function keyIsProvider(id) {
  return (property) => property.key === id || property.key.startsWith(`${id}.`);
}

function productionSources(files) {
  return Object.entries(files).filter(([filePath]) => !isTestPath(filePath));
}

function identifierCount(files, name, { tests = true } = {}) {
  let count = 0;
  for (const [filePath, source] of Object.entries(files)) {
    if (!tests && isTestPath(filePath)) continue;
    if (source === undefined) continue;
    count += countIdentifiers(source, name);
  }
  return count;
}

function declaredIn(files, name) {
  for (const [filePath, source] of productionSources(files)) {
    if (new RegExp(`(?:function|const|class|type|interface|enum)\\s+${name}\\b`).test(source)) {
      return filePath;
    }
  }
  return undefined;
}

function eliminateDeadDeclarations(files, seeds) {
  const pending = [...seeds];
  const removed = new Set();
  let guard = 0;
  while (pending.length > 0 && guard < 200) {
    guard += 1;
    const name = pending.shift();
    if (!name || removed.has(name)) continue;
    const filePath = declaredIn(files, name);
    if (!filePath) continue;
    if (identifierCount(files, name, { tests: false }) !== 1) continue;

    const before = files[filePath];
    const transformed = transformSource(before, { id: "\0", dropDeclaration: name });
    if (transformed.text === before) continue;
    files[filePath] = transformed.text;
    removed.add(name);
    const declarationText = transformed.removedTexts.join("\n");
    for (const match of declarationText.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g)) {
      if (declaredIn(files, match[1])) pending.push(match[1]);
    }
  }
  return removed;
}

function transformTree(files, ctx) {
  const removedTexts = [];
  for (const [filePath, source] of Object.entries(files)) {
    if (source === undefined || !filePath.startsWith("src/")) continue;
    try {
      let text = removeImportsFrom(source, `providerRules/${ctx.id}`);
      text = removeImportSpecifiers(text, ctx.dropBindings);
      text = replaceProviderTernary(text, ctx.id);
      if (ctx.dropBindings.size > 0) {
        text = removeArrayElements(text, (value) => {
          for (const name of ctx.dropBindings) {
            if (countIdentifiers(value, name) > 0) return true;
          }
          return false;
        });
      }
      const transformed = transformSource(text, ctx);
      files[filePath] = transformed.text;
      removedTexts.push(...transformed.removedTexts);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${filePath}: ${message}`);
    }
  }
  return removedTexts;
}

export function pruneProviderSources(files, provider) {
  const { id, iconSlug, knownIds } = provider;
  const next = { ...files };
  const removedTexts = [];
  const deleted = [];
  let removedCatalogEntry = false;

  const rulesPath = providerRulesPath(id);
  const ruleExports = next[rulesPath] ? exportedBindings(next[rulesPath]) : [];

  const record = (filePath, result) => {
    if (next[filePath] === undefined) return;
    next[filePath] = result.source;
    for (const entry of result.removed) {
      removedTexts.push(typeof entry === "string" ? entry : entry.text);
    }
  };

  if (next[CATALOG] !== undefined) {
    const catalogEdit = editObject(next[CATALOG], "PROVIDER_CATALOG", keyIsProvider(id));
    removedCatalogEntry = catalogEdit.removed.length > 0;
    record(CATALOG, catalogEdit);
    record(
      CATALOG,
      editObject(next[CATALOG], "PROVIDER_ID_ALIASES", (property) => {
        const value = property.value.trim();
        return (value.startsWith('"') || value.startsWith("'")) && value.slice(1, -1) === id;
      }),
    );
  }

  const customIds = [];
  if (next[PACE] !== undefined) {
    const pace = editObject(next[PACE], "PACE_CAPABILITIES", keyIsProvider(id));
    for (const entry of pace.removed) customIds.push(...customIdsIn(entry.text));
    record(PACE, pace);
    record(PACE, editObject(next[PACE], "DYNAMIC_SLOT_TITLES", keyIsProvider(id)));
    record(PACE, editObject(next[PACE], "UNPORTABLE_DYNAMIC_TITLES", keyIsProvider(id)));
    record(
      PACE,
      editNamedSet(next[PACE], "EXTRA_WINDOW_PACE_PROVIDER_IDS", (value) => value.trim().slice(1, -1) === id),
    );
    record(
      PACE,
      editNamedSet(next[PACE], "WEEKLY_ONLY_EXTRA_WINDOW_PROVIDER_IDS", (value) => value.trim().slice(1, -1) === id),
    );
    for (const customId of customIds) {
      record(PACE, editObject(next[PACE], "CUSTOM_WINDOW_RULES", (property) => property.key === customId));
      const withoutMember = removeUnionMember(next[PACE], "PaceCustomId", customId);
      if (withoutMember !== next[PACE]) {
        removedTexts.push(customId);
        next[PACE] = withoutMember;
      }
    }
  }

  if (next[MOCKS] !== undefined) {
    for (const objectName of ["MOCK_BUILDERS", "MOCK_SOURCES", "MOCK_VERSIONS"]) {
      const edited = editObject(next[MOCKS], objectName, keyIsProvider(id));
      for (const entry of edited.removed) {
        const builder = bareIdentifier(entry.value);
        if (builder) removedTexts.push(builder);
      }
      record(MOCKS, edited);
    }
  }

  if (next[CHECK] !== undefined) {
    record(CHECK, editObject(next[CHECK], "ALLOWED_DIVERGENCES", keyIsProvider(id)));
    record(CHECK, editObject(next[CHECK], "UNPORTABLE_PRESENTATION_PACE", keyIsProvider(id)));
    record(CHECK, editObject(next[CHECK], "UNPORTABLE_HEADROOM_HINT", keyIsProvider(id)));
    record(CHECK, editObject(next[CHECK], "CUSTOM_PACE_RULES", keyIsProvider(id)));
  }

  if (next[rulesPath] !== undefined) {
    removedTexts.push(next[rulesPath]);
    delete next[rulesPath];
    deleted.push(rulesPath);
  }

  if (iconSlug && removedCatalogEntry && provider.deleteIcon !== false) {
    deleted.push(`assets/provider-icons/${iconSlug}.svg`);
  }

  const ctx = {
    id,
    knownIds: new Set(knownIds),
    removedIds: new Set(provider.removedIds ?? [id]),
    dropBindings: new Set(ruleExports),
  };
  removedTexts.push(...transformTree(next, ctx));

  const seeds = new Set(ruleExports);
  for (const customId of customIds) seeds.add(customId);
  for (const text of removedTexts) {
    for (const match of text.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g)) {
      if (declaredIn(next, match[1])) seeds.add(match[1]);
    }
  }
  const dead = eliminateDeadDeclarations(next, seeds);
  if (dead.size > 0) {
    transformTree(next, { id: "\0", knownIds: new Set(), dropBindings: dead });
  }

  const leftovers = [];
  const testMentions = [];
  for (const [filePath, source] of Object.entries(next)) {
    if (source === undefined || !filePath.startsWith("src/")) continue;
    let lines = [];
    try {
      lines = literalLocations(source, id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${filePath}: ${message}`);
    }
    for (const line of lines) {
      const mention = `${filePath}:${line}`;
      if (isTestPath(filePath)) testMentions.push(mention);
      else leftovers.push(mention);
    }
  }

  return { files: next, deleted, leftovers, testMentions };
}

export function keptIconSlugs(catalog, removedIds) {
  const removed = new Set(removedIds);
  return new Set(
    Object.entries(catalog)
      .filter(([id]) => !removed.has(id))
      .map(([, entry]) => entry.iconSlug),
  );
}


