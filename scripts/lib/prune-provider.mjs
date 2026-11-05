// Plans the closed edit that drops a Provider upstream no longer ships.
// The edit deletes that Provider's directory, regenerates the module index,
// and drops the id from the catalog order and the upstream allowlists.
// A production reference that would survive the edit blocks the write.

import { METER_DETAIL_PATH } from "./meter-detail.mjs";
import { PROVIDER_INDEX_PATH, providerModuleIdsFromFiles, renderProviderIndex } from "./provider-modules.mjs";

const ORDER_PATH = "scripts/lib/provider-modules.mjs";
const CHECK_PATH = "scripts/check-upstream.mjs";
const PACE_PATH = "src/providers/paceCapabilities.ts";

const ALLOWLISTS = [
  [CHECK_PATH, "CUSTOM_PACE_RULES", (key, id) => key === id || key.startsWith(`${id}.`)],
  [CHECK_PATH, "ALLOWED_DIVERGENCES", (key, id) => key === id],
  [CHECK_PATH, "UNPORTABLE_PRESENTATION_PACE", (key, id) => key === id],
  [CHECK_PATH, "UNPORTABLE_HEADROOM_HINT", (key, id) => key === id],
  [CHECK_PATH, "UNPORTABLE_MENU_CARD", (key, id) => key === id],
  [PACE_PATH, "UNPORTABLE_DYNAMIC_TITLES", (key, id) => key === id],
  [METER_DETAIL_PATH, "METER_DETAIL", (key, id) => key === id],
];

const REWRITTEN = new Set([PROVIDER_INDEX_PATH, ORDER_PATH, CHECK_PATH, PACE_PATH, METER_DETAIL_PATH]);

export function planPrune(files, removed) {
  try {
    return planOrThrow(files, removed);
  } catch (error) {
    return {
      ok: false,
      files,
      updates: [],
      deleted: [],
      blockers: [error instanceof Error ? error.message : String(error)],
      testMentions: [],
    };
  }
}

function planOrThrow(files, removed) {
  const next = { ...files };
  const deleted = [];
  const ids = removed.map((provider) => provider.id);

  for (const provider of removed) {
    const prefix = `src/providers/${provider.id}/`;
    for (const filePath of Object.keys(next)) {
      if (!filePath.startsWith(prefix) || next[filePath] === undefined) continue;
      deleted.push(filePath);
      delete next[filePath];
    }
  }

  if (next[ORDER_PATH] !== undefined) {
    next[ORDER_PATH] = removeOrderIds(next[ORDER_PATH], ids);
  }

  for (const provider of removed) {
    for (const [filePath, binding, matches] of ALLOWLISTS) {
      if (next[filePath] === undefined) continue;
      next[filePath] = removeObjectProperties(next[filePath], binding, (key) => matches(key, provider.id));
    }
  }

  if (next[PROVIDER_INDEX_PATH] !== undefined) {
    next[PROVIDER_INDEX_PATH] = renderProviderIndex(providerModuleIdsFromFiles(next));
  }

  const usedSlugs = new Set();
  for (const [filePath, source] of Object.entries(next)) {
    if (source === undefined || !/^src\/providers\/[^/]+\/index\.ts$/.test(filePath)) continue;
    const slug = iconSlugOf(source);
    if (slug) usedSlugs.add(slug);
  }
  for (const provider of removed) {
    if (!provider.iconSlug || usedSlugs.has(provider.iconSlug)) continue;
    const iconPath = `assets/provider-icons/${provider.iconSlug}.svg`;
    if (!deleted.includes(iconPath)) deleted.push(iconPath);
  }

  const blockers = [];
  const testMentions = [];
  for (const provider of removed) {
    for (const [filePath, source] of Object.entries(next)) {
      if (source === undefined || REWRITTEN.has(filePath)) continue;
      if (!filePath.startsWith("src/") && !filePath.startsWith("scripts/")) continue;
      const hits = mentionLines(source, provider.id, filePath);
      for (const hit of hits) {
        const mention = `${filePath}:${hit}: ${provider.id}`;
        if (isTestPath(filePath)) testMentions.push(mention);
        else blockers.push(mention);
      }
    }
  }

  const updates = Object.keys(next)
    .filter((filePath) => next[filePath] !== files[filePath])
    .sort();
  deleted.sort();
  blockers.sort();
  testMentions.sort();

  return {
    ok: blockers.length === 0,
    files: blockers.length === 0 ? next : files,
    updates: blockers.length === 0 ? updates : [],
    deleted: blockers.length === 0 ? deleted : [],
    blockers,
    testMentions,
  };
}

export function removeOrderIds(source, ids) {
  const marker = "export const CATALOG_PROVIDER_ORDER = [";
  const start = source.indexOf(marker);
  if (start < 0) {
    return source;
  }
  const open = source.indexOf("[", start);
  const close = source.indexOf("];", open);
  if (close < 0) {
    throw new Error("CATALOG_PROVIDER_ORDER is not a closed array");
  }
  let body = source.slice(open + 1, close);
  for (const id of ids) {
    if (!body.includes(`"${id}"`) && !body.includes(`'${id}'`)) continue;
    const line = new RegExp(`\\n[ \\t]*(["'])${escapeRegExp(id)}\\1,?[ \\t]*`);
    const stripped = body.replace(line, "\n");
    if (stripped === body) {
      throw new Error(`Could not remove ${id} from CATALOG_PROVIDER_ORDER`);
    }
    body = stripped;
  }
  return source.slice(0, open + 1) + body + source.slice(close);
}

export function removeObjectProperties(source, binding, shouldRemove) {
  const open = findAssignedObject(source, binding);
  if (open < 0) return source;
  const { end, props } = walkObject(source, open);
  const removed = props.filter((prop) => shouldRemove(prop.key));
  if (removed.length === 0) return source;

  const ranges = [];
  for (const prop of removed) {
    if (prop.comma >= 0) {
      const from = lineStart(source, prop.start);
      let to = prop.comma + 1;
      if (source[to] === "\n") to += 1;
      ranges.push([from, to]);
      continue;
    }
    const previousComma = previousPropertyComma(props, prop);
    if (previousComma >= 0) {
      ranges.push([previousComma, prop.valueEnd]);
      continue;
    }
    ranges.push([lineStart(source, prop.start), prop.valueEnd]);
  }

  let next = source;
  for (const [from, to] of ranges.sort((left, right) => right[0] - left[0])) {
    next = next.slice(0, from) + next.slice(to);
  }
  const checked = findAssignedObject(next, binding);
  if (checked < 0) {
    throw new Error(`Could not parse ${binding} after removing a property`);
  }
  walkObject(next, checked);
  return next;
}

function findAssignedObject(source, binding) {
  const at = source.search(new RegExp(`(?:export\\s+)?const\\s+${binding}\\b`));
  if (at < 0) return -1;
  let brace = 0;
  let angle = 0;
  let i = at;
  while (i < source.length) {
    const trivia = skipTrivia(source, i);
    if (trivia !== i) {
      i = trivia;
      continue;
    }
    const quote = source[i];
    if (quote === '"' || quote === "'" || quote === "`") {
      i = skipString(source, i);
      continue;
    }
    const char = source[i];
    if (char === "{") brace += 1;
    else if (char === "}") brace -= 1;
    else if (char === "<") angle += 1;
    else if (char === ">") angle -= 1;
    else if (char === "=" && brace === 0 && angle === 0) {
      let j = skipTrivia(source, i + 1);
      while (j < source.length && /\s/.test(source[j])) j += 1;
      if (source[j] !== "{") {
        throw new Error(`${binding} is not assigned an object`);
      }
      return j;
    }
    i += 1;
  }
  throw new Error(`Could not find the object assigned to ${binding}`);
}

function walkObject(source, open) {
  let i = open + 1;
  const props = [];
  while (i < source.length) {
    i = skipSpace(source, i);
    if (source[i] === "}") return { end: i, props };
    if (i >= source.length) break;
    const start = i;
    const key = readKey(source, i);
    i = skipSpace(source, key.end);
    if (source[i] !== ":") {
      throw new Error(`Expected ':' after ${key.text} in object`);
    }
    const valueEnd = skipValue(source, i + 1);
    i = skipSpace(source, valueEnd);
    let comma = -1;
    if (source[i] === ",") {
      comma = i;
      i += 1;
    }
    props.push({ key: key.text, start, valueEnd, comma });
    if (comma < 0) {
      i = skipSpace(source, i);
      if (source[i] !== "}") {
        throw new Error(`Expected ',' or '}' after ${key.text}`);
      }
    }
  }
  throw new Error("Unterminated object");
}

function readKey(source, index) {
  const char = source[index];
  if (char === '"' || char === "'" || char === "`") {
    const end = skipString(source, index);
    return { text: source.slice(index + 1, end - 1), end };
  }
  const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(index));
  if (!match) {
    throw new Error(`Expected a property name at index ${index}`);
  }
  return { text: match[0], end: index + match[0].length };
}

function skipValue(source, index) {
  let i = skipSpace(source, index);
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  let started = false;
  while (i < source.length) {
    const trivia = skipTrivia(source, i);
    if (trivia !== i) {
      i = trivia;
      continue;
    }
    const quote = source[i];
    if (quote === '"' || quote === "'" || quote === "`") {
      i = skipString(source, i);
      started = true;
      continue;
    }
    const char = source[i];
    if (!started && /\s/.test(char)) {
      i += 1;
      continue;
    }
    started = true;
    if (char === "{") brace += 1;
    else if (char === "}") {
      if (brace === 0 && bracket === 0 && paren === 0) return i;
      brace -= 1;
    } else if (char === "[") bracket += 1;
    else if (char === "]") bracket -= 1;
    else if (char === "(") paren += 1;
    else if (char === ")") paren -= 1;
    else if (char === "," && brace === 0 && bracket === 0 && paren === 0) return i;
    i += 1;
  }
  throw new Error("Unterminated value");
}

function skipSpace(source, index) {
  let i = index;
  while (i < source.length) {
    const trivia = skipTrivia(source, i);
    if (trivia !== i) {
      i = trivia;
      continue;
    }
    if (!/\s/.test(source[i])) return i;
    i += 1;
  }
  return i;
}

function skipTrivia(source, index) {
  if (source.startsWith("//", index)) {
    const newline = source.indexOf("\n", index);
    return newline < 0 ? source.length : newline + 1;
  }
  if (source.startsWith("/*", index)) {
    const end = source.indexOf("*/", index + 2);
    if (end < 0) throw new Error("Unterminated comment");
    return end + 2;
  }
  return index;
}

function skipString(source, index) {
  const quote = source[index];
  let i = index + 1;
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    i += 1;
  }
  throw new Error("Unterminated string");
}

function previousPropertyComma(props, prop) {
  const index = props.indexOf(prop);
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (props[cursor].comma >= 0) return props[cursor].comma;
  }
  return -1;
}

function lineStart(source, index) {
  const newline = source.lastIndexOf("\n", index - 1);
  return newline + 1;
}

function iconSlugOf(source) {
  const match = source.match(/iconSlug:\s*(["'`])([^"'`]+)\1/);
  return match?.[2];
}

function mentionLines(source, id, filePath) {
  const lines = new Set();
  const literal = new RegExp(`(["'\`])${escapeRegExp(id)}\\1`, "g");
  for (const match of source.matchAll(literal)) {
    const line = lineOf(source, match.index);
    if (isSharedIconLine(filePath, source.split("\n")[line - 1], id)) continue;
    lines.add(line);
  }
  const pathHit = new RegExp(`(?:providers|providerRules)/${escapeRegExp(id)}(?![A-Za-z0-9_])`, "g");
  for (const match of source.matchAll(pathHit)) lines.add(lineOf(source, match.index));
  const urlHit = new RegExp(`/${escapeRegExp(id)}/`, "g");
  for (const match of source.matchAll(urlHit)) lines.add(lineOf(source, match.index));
  return [...lines].sort((left, right) => left - right);
}

function isSharedIconLine(filePath, line, id) {
  if (!/^src\/providers\/[^/]+\/index\.ts$/.test(filePath)) return false;
  if (filePath === `src/providers/${id}/index.ts`) return false;
  return new RegExp(`iconSlug:\\s*(["'\`])${escapeRegExp(id)}\\1`).test(line);
}

function isTestPath(filePath) {
  return /\.test\.(tsx?|mjs)$/.test(filePath);
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
