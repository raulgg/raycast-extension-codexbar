// Deletes the table rows for a provider upstream no longer ships.
// Catalog entry, aliases, mocks, pace rows, allowlists, the provider-rules file,
// and the icon. Call sites and tests are left in place and reported.

const CATALOG = "src/providers/catalog.ts";
const PACE = "src/providers/paceCapabilities.ts";
const MOCKS = "src/cli/mockPayloads.ts";
const CHECK = "scripts/check-upstream.mjs";

function providerRulesPath(id) {
  return `src/usage/providerRules/${id}.ts`;
}

function assertProviderId(id) {
  if (!/^[A-Za-z0-9]+$/.test(id)) {
    throw new Error(`Unsafe provider id "${id}".`);
  }
  return id;
}

function consumeBoundary(source, index) {
  if (source.startsWith("//", index)) {
    const newline = source.indexOf("\n", index);
    return newline === -1 ? source.length : newline + 1;
  }
  if (source.startsWith("/*", index)) {
    const end = source.indexOf("*/", index + 2);
    if (end === -1) throw new Error("Unterminated block comment.");
    return end + 2;
  }
  const quote = source[index];
  if (quote === '"' || quote === "'" || quote === "`") {
    let cursor = index + 1;
    while (cursor < source.length) {
      if (source[cursor] === "\\") {
        cursor += 2;
        continue;
      }
      if (source[cursor] === quote) return cursor + 1;
      cursor += 1;
    }
    throw new Error("Unterminated string.");
  }
  return index;
}

function skipTrivia(source, index) {
  let cursor = index;
  while (cursor < source.length) {
    const next = consumeBoundary(source, cursor);
    if (next !== cursor) {
      if (source.startsWith("//", cursor) || source.startsWith("/*", cursor)) {
        cursor = next;
        continue;
      }
      return cursor;
    }
    if (source[cursor] === " " || source[cursor] === "\t" || source[cursor] === "\n" || source[cursor] === "\r") {
      cursor += 1;
      continue;
    }
    return cursor;
  }
  return cursor;
}

function scanBalanced(source, openIndex, openChar, closeChar) {
  if (source[openIndex] !== openChar) {
    throw new Error(`Expected ${openChar}.`);
  }
  let depth = 0;
  let cursor = openIndex;
  while (cursor < source.length) {
    const next = consumeBoundary(source, cursor);
    if (next !== cursor) {
      cursor = next;
      continue;
    }
    if (source[cursor] === openChar) depth += 1;
    else if (source[cursor] === closeChar) {
      depth -= 1;
      if (depth === 0) return cursor;
    }
    cursor += 1;
  }
  throw new Error(`Unbalanced ${openChar}${closeChar}.`);
}

function readKey(source, index) {
  if (source[index] === '"' || source[index] === "'") {
    const end = consumeBoundary(source, index);
    return { end, text: source.slice(index + 1, end - 1) };
  }
  const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(index));
  if (!match) return undefined;
  return { end: index + match[0].length, text: match[0] };
}

function readValueEnd(source, index) {
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let cursor = index;
  while (cursor < source.length) {
    const next = consumeBoundary(source, cursor);
    if (next !== cursor) {
      cursor = next;
      continue;
    }
    const character = source[cursor];
    if (character === "(") paren += 1;
    else if (character === ")") paren -= 1;
    else if (character === "[") bracket += 1;
    else if (character === "]") bracket -= 1;
    else if (character === "{") brace += 1;
    else if (character === "}") {
      if (brace === 0 && paren === 0 && bracket === 0) return cursor;
      brace -= 1;
    } else if (character === "," && brace === 0 && paren === 0 && bracket === 0) {
      return cursor;
    }
    cursor += 1;
  }
  return source.length;
}

function consumeTrailingComma(source, index) {
  let cursor = index;
  if (source[cursor] === ",") cursor += 1;
  while (source[cursor] === " " || source[cursor] === "\t") cursor += 1;
  if (source.startsWith("//", cursor)) {
    const newline = source.indexOf("\n", cursor);
    return newline === -1 ? source.length : newline;
  }
  return cursor;
}

function findAssignedObject(source, name) {
  const declaration = new RegExp(`(?:export\\s+)?const\\s+${name}\\b`).exec(source);
  if (!declaration) return undefined;
  const equals = source.indexOf("=", declaration.index + declaration[0].length);
  if (equals === -1) throw new Error(`No assignment for ${name}.`);
  const brace = source.indexOf("{", equals);
  if (brace === -1) throw new Error(`No object literal for ${name}.`);
  return { start: brace, end: scanBalanced(source, brace, "{", "}") };
}

function editObjectBody(body, shouldRemove) {
  let text = "";
  const removed = [];
  let index = 0;
  while (index < body.length) {
    const triviaStart = index;
    index = skipTrivia(body, index);
    if (index >= body.length) {
      text += body.slice(triviaStart);
      break;
    }
    if (body.startsWith("...", index)) {
      const entryEnd = consumeTrailingComma(body, readValueEnd(body, index));
      text += body.slice(triviaStart, entryEnd);
      index = entryEnd;
      continue;
    }
    const key = readKey(body, index);
    if (!key) {
      text += body.slice(triviaStart);
      break;
    }
    let cursor = skipTrivia(body, key.end);
    let valueStart = cursor;
    let valueEnd = cursor;
    if (body[cursor] === "(") {
      const parenEnd = scanBalanced(body, cursor, "(", ")");
      const brace = skipTrivia(body, parenEnd + 1);
      if (body[brace] !== "{") throw new Error(`Method ${key.text} has no body.`);
      valueEnd = scanBalanced(body, brace, "{", "}") + 1;
      valueStart = cursor;
    } else if (body[cursor] === ":") {
      valueStart = skipTrivia(body, cursor + 1);
      valueEnd = readValueEnd(body, valueStart);
    } else if (body[cursor] !== "," && body[cursor] !== "}" && cursor < body.length) {
      throw new Error(`Unexpected token after ${key.text}.`);
    }
    const entryEnd = consumeTrailingComma(body, valueEnd);
    if (shouldRemove({ key: key.text, value: body.slice(valueStart, valueEnd), text: body.slice(index, entryEnd) })) {
      removed.push({ key: key.text, value: body.slice(valueStart, valueEnd), text: body.slice(index, entryEnd) });
      index = entryEnd;
      continue;
    }
    text += body.slice(triviaStart, entryEnd);
    index = entryEnd;
  }
  return { text, removed };
}

function editNamedObject(source, name, shouldRemove) {
  const found = findAssignedObject(source, name);
  if (!found) return { source, removed: [] };
  const edited = editObjectBody(source.slice(found.start + 1, found.end), shouldRemove);
  if (edited.removed.length === 0) return { source, removed: [] };
  return {
    source: `${source.slice(0, found.start + 1)}${edited.text}${source.slice(found.end)}`,
    removed: edited.removed,
  };
}

function editListBody(body, shouldRemoveValue) {
  let text = "";
  const removed = [];
  let index = 0;
  while (index < body.length) {
    const triviaStart = index;
    index = skipTrivia(body, index);
    if (index >= body.length) {
      text += body.slice(triviaStart);
      break;
    }
    const valueEnd = readValueEnd(body, index);
    const entryEnd = consumeTrailingComma(body, valueEnd);
    const valueText = body.slice(index, valueEnd);
    if (shouldRemoveValue(valueText)) {
      removed.push(valueText);
      index = entryEnd;
      continue;
    }
    text += body.slice(triviaStart, entryEnd);
    index = entryEnd;
  }
  return { text, removed };
}

function editNamedSet(source, name, shouldRemoveValue) {
  const declaration = new RegExp(`(?:export\\s+)?const\\s+${name}\\b`).exec(source);
  if (!declaration) return { source, removed: [] };
  const bracket = source.indexOf("[", declaration.index);
  if (bracket === -1 || !source.slice(declaration.index, bracket).includes("new Set")) {
    return { source, removed: [] };
  }
  const close = scanBalanced(source, bracket, "[", "]");
  const edited = editListBody(source.slice(bracket + 1, close), shouldRemoveValue);
  if (edited.removed.length === 0) return { source, removed: [] };
  return {
    source: `${source.slice(0, bracket + 1)}${edited.text}${source.slice(close)}`,
    removed: edited.removed,
  };
}

function removeUnionMember(source, typeName, member) {
  const declaration = new RegExp(`(?:export\\s+)?type\\s+${typeName}\\b`).exec(source);
  if (!declaration) return source;
  const line = new RegExp(`^\\s*\\|\\s*["']${member}["']\\s*;?\\s*$`, "m");
  const match = line.exec(source.slice(declaration.index));
  if (!match) return source;
  const start = declaration.index + match.index;
  let end = start + match[0].length;
  if (source[end] === "\n") end += 1;
  const hadSemicolon = source.slice(start, end).includes(";");
  let before = source.slice(0, start);
  if (hadSemicolon) {
    const previousMember = /\|[^\n]*(?=\n?$)/.exec(before);
    if (previousMember && !previousMember[0].includes(";")) {
      const lineEnd = previousMember.index + previousMember[0].length;
      before = `${before.slice(0, lineEnd)};${before.slice(lineEnd)}`;
    }
  }
  return before + source.slice(end);
}

function paceCustomIdContains(source, member) {
  const declaration = /(?:export\s+)?type\s+PaceCustomId\b/.exec(source);
  if (!declaration) return false;
  const semicolon = source.indexOf(";", declaration.index);
  if (semicolon === -1) return false;
  return new RegExp(`["']${member}["']`).test(source.slice(declaration.index, semicolon));
}

function keyIsProvider(id) {
  return (property) => property.key === id || property.key.startsWith(`${id}.`);
}

function stringValueIs(value, id) {
  const trimmed = value.trim();
  return (trimmed.startsWith('"') || trimmed.startsWith("'")) && trimmed.slice(1, -1) === id;
}

function bareIdentifier(value) {
  const trimmed = value.trim();
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(trimmed) ? trimmed : undefined;
}

function customIdsIn(text) {
  return [...text.matchAll(/\bid:\s*["']([A-Za-z0-9_]+)["']/g)].map((match) => match[1]);
}

function lineMentionsProvider(line, id, keptIconSlugs) {
  const exactString = new RegExp(`(["'\`])${id}\\1`, "g");
  for (const match of line.matchAll(exactString)) {
    const before = line.slice(0, match.index);
    if (keptIconSlugs.has(id) && /iconSlug:\s*$/.test(before)) continue;
    return true;
  }
  return new RegExp(`/${id}(?=/|["'\`]|\\.tsx?\\b|$)`).test(line);
}

function mentionLines(source, id, keptIconSlugs) {
  const lines = [];
  const rows = source.split("\n");
  for (let index = 0; index < rows.length; index += 1) {
    if (lineMentionsProvider(rows[index], id, keptIconSlugs)) lines.push(`${index + 1}`);
  }
  return lines;
}

export function collectProviderMentions(files, id, keptIconSlugs = []) {
  const kept = keptIconSlugs instanceof Set ? keptIconSlugs : new Set(keptIconSlugs);
  const mentions = [];
  for (const [filePath, source] of Object.entries(files)) {
    if (source === undefined || filePath === "scripts/prune-removed-providers.test.mjs") continue;
    for (const line of mentionLines(source, assertProviderId(id), kept)) {
      mentions.push(`${filePath}:${line}`);
    }
  }
  return mentions;
}

export function pruneProviderSources(files, provider) {
  const id = assertProviderId(provider.id);
  const { iconSlug } = provider;
  const keptSlugs = new Set(provider.keptIconSlugs ?? []);
  const next = { ...files };
  const deleted = [];
  const mentions = [];
  let removedCatalogEntry = false;

  const record = (filePath, result) => {
    if (next[filePath] === undefined) return;
    next[filePath] = result.source;
  };

  if (next[CATALOG] !== undefined) {
    const catalogEdit = editNamedObject(next[CATALOG], "PROVIDER_CATALOG", keyIsProvider(id));
    removedCatalogEntry = catalogEdit.removed.length > 0;
    record(CATALOG, catalogEdit);
    record(
      CATALOG,
      editNamedObject(next[CATALOG], "PROVIDER_ID_ALIASES", (property) => stringValueIs(property.value, id)),
    );
  }

  const customIds = [];
  if (next[PACE] !== undefined) {
    const pace = editNamedObject(next[PACE], "PACE_CAPABILITIES", keyIsProvider(id));
    for (const entry of pace.removed) customIds.push(...customIdsIn(entry.text));
    record(PACE, pace);
    record(PACE, editNamedObject(next[PACE], "DYNAMIC_SLOT_TITLES", keyIsProvider(id)));
    record(PACE, editNamedObject(next[PACE], "UNPORTABLE_DYNAMIC_TITLES", keyIsProvider(id)));
    record(PACE, editNamedSet(next[PACE], "EXTRA_WINDOW_PACE_PROVIDER_IDS", (value) => stringValueIs(value, id)));
    record(
      PACE,
      editNamedSet(next[PACE], "WEEKLY_ONLY_EXTRA_WINDOW_PROVIDER_IDS", (value) => stringValueIs(value, id)),
    );
    for (const customId of customIds) {
      record(PACE, editNamedObject(next[PACE], "CUSTOM_WINDOW_RULES", (property) => property.key === customId));
      const withoutMember = removeUnionMember(next[PACE], "PaceCustomId", customId);
      if (withoutMember !== next[PACE]) next[PACE] = withoutMember;
      if (paceCustomIdContains(next[PACE], customId)) {
        mentions.push(`${PACE}: pace rule ${customId} is still in PaceCustomId`);
      }
      if (new RegExp(`function\\s+${customId}\\b`).test(next[PACE])) {
        mentions.push(`${PACE}: pace rule ${customId} is still declared`);
      }
    }
  }

  if (next[MOCKS] !== undefined) {
    for (const objectName of ["MOCK_BUILDERS", "MOCK_SOURCES", "MOCK_VERSIONS"]) {
      const edited = editNamedObject(next[MOCKS], objectName, keyIsProvider(id));
      record(MOCKS, edited);
      for (const entry of edited.removed) {
        const builder = bareIdentifier(entry.value);
        if (builder && new RegExp(`function\\s+${builder}\\b`).test(next[MOCKS])) {
          mentions.push(`${MOCKS}: mock builder ${builder} is still declared`);
        }
      }
    }
  }

  if (next[CHECK] !== undefined) {
    record(CHECK, editNamedObject(next[CHECK], "ALLOWED_DIVERGENCES", keyIsProvider(id)));
    record(CHECK, editNamedObject(next[CHECK], "UNPORTABLE_PRESENTATION_PACE", keyIsProvider(id)));
    record(CHECK, editNamedObject(next[CHECK], "UNPORTABLE_HEADROOM_HINT", keyIsProvider(id)));
    record(CHECK, editNamedObject(next[CHECK], "CUSTOM_PACE_RULES", keyIsProvider(id)));
  }

  const rulesPath = providerRulesPath(id);
  if (next[rulesPath] !== undefined) {
    delete next[rulesPath];
    deleted.push(rulesPath);
  }

  if (iconSlug && removedCatalogEntry && provider.deleteIcon !== false) {
    deleted.push(`assets/provider-icons/${iconSlug}.svg`);
  }

  if (provider.scan !== false) {
    mentions.push(...collectProviderMentions(next, id, keptSlugs));
  }

  return { files: next, deleted, mentions };
}

export function keptIconSlugs(catalog, removedIds) {
  const removed = new Set(removedIds);
  return new Set(
    Object.entries(catalog)
      .filter(([id]) => !removed.has(id))
      .map(([, entry]) => entry.iconSlug),
  );
}
