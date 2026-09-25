// String- and comment-aware edits for the TypeScript and JavaScript sources the
// upstream prune rewrites. The scanners throw when a literal is unterminated, so a
// format change fails the prune instead of deleting the wrong span.

function previousCodeCharacter(source, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (!/\s/.test(source[cursor])) return source[cursor];
  }
  return "";
}

function wordBefore(source, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(source[cursor])) cursor -= 1;
  const end = cursor + 1;
  while (cursor >= 0 && /[A-Za-z0-9_$]/.test(source[cursor])) cursor -= 1;
  return source.slice(cursor + 1, end);
}

function canStartRegex(source, index) {
  // `}` covers JSX `{expr} />`. A regex after `return` is a literal, not division.
  if (["return", "throw", "case", "typeof", "void", "delete", "await", "yield", "else"].includes(wordBefore(source, index))) {
    return true;
  }
  return !/[A-Za-z0-9_$)\]"'<}]/.test(previousCodeCharacter(source, index));
}

function skipRegex(source, index) {
  let inClass = false;
  for (let cursor = index + 1; cursor < source.length; cursor += 1) {
    if (source[cursor] === "\\") {
      cursor += 1;
      continue;
    }
    if (source[cursor] === "[" && !inClass) inClass = true;
    else if (source[cursor] === "]" && inClass) inClass = false;
    else if (source[cursor] === "/" && !inClass) {
      let flags = cursor + 1;
      while (/[a-z]/i.test(source[flags] ?? "")) flags += 1;
      return flags;
    } else if (source[cursor] === "\n") {
      throw new Error(
        `Unterminated regular expression near ${JSON.stringify(source.slice(Math.max(0, index - 40), index + 40))}.`,
      );
    }
  }
  throw new Error(
    `Unterminated regular expression near ${JSON.stringify(source.slice(Math.max(0, index - 40), index + 40))}.`,
  );
}

export function consumeBoundary(source, index) {
  if (source.startsWith("//", index)) {
    const newline = source.indexOf("\n", index);
    return newline === -1 ? source.length : newline + 1;
  }

  if (source.startsWith("/*", index)) {
    const end = source.indexOf("*/", index + 2);
    if (end === -1) {
      throw new Error("Unterminated block comment.");
    }
    return end + 2;
  }

  if (source[index] === "/" && canStartRegex(source, index)) {
    return skipRegex(source, index);
  }

  const quote = source[index];
  if (quote === '"' || quote === "'" || quote === "`") {
    return skipString(source, index);
  }

  return index;
}

export function skipString(source, index) {
  const quote = source[index];
  let cursor = index + 1;
  while (cursor < source.length) {
    if (source[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (quote === "`" && source.startsWith("${", cursor)) {
      const close = scanBalanced(source, cursor + 1, "{", "}");
      cursor = close + 1;
      continue;
    }
    if (source[cursor] === quote) {
      return cursor + 1;
    }
    cursor += 1;
  }

  throw new Error("Unterminated string.");
}

export function scanBalanced(source, openIndex, openChar, closeChar) {
  if (source[openIndex] !== openChar) {
    throw new Error(`Expected ${openChar} at ${openIndex}.`);
  }

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const next = consumeBoundary(source, index);
    if (next !== index) {
      index = next - 1;
      continue;
    }

    const character = source[index];
    if (character === openChar) {
      depth += 1;
    } else if (character === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  throw new Error(`Unbalanced ${openChar}${closeChar}.`);
}

export function skipTrivia(source, index) {
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

export function decodeStringLiteral(literal) {
  const trimmed = literal.trim();
  const quote = trimmed[0];
  if ((quote !== '"' && quote !== "'" && quote !== "`") || trimmed.at(-1) !== quote || trimmed.length < 2) {
    return undefined;
  }
  if (quote === "`" && trimmed.includes("${")) {
    return undefined;
  }
  return trimmed.slice(1, -1).replace(/\\(.)/g, "$1");
}

export function stringLiterals(source) {
  const values = [];
  for (let index = 0; index < source.length; index += 1) {
    const next = consumeBoundary(source, index);
    if (next !== index) {
      if (source[index] === '"' || source[index] === "'" || source[index] === "`") {
        const value = decodeStringLiteral(source.slice(index, next));
        if (value !== undefined) {
          values.push(value);
        }
      }
      index = next - 1;
      continue;
    }
  }
  return values;
}

export function countIdentifiers(source, name) {
  let count = 0;
  for (let index = 0; index < source.length; index += 1) {
    const next = consumeBoundary(source, index);
    if (next !== index) {
      index = next - 1;
      continue;
    }
    if (!/[A-Za-z_$]/.test(source[index])) {
      continue;
    }
    const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(index));
    if (match?.[0] === name) {
      count += 1;
    }
    index += (match?.[0].length ?? 1) - 1;
  }
  return count;
}

function readKey(source, index) {
  if (source[index] === '"' || source[index] === "'") {
    const end = skipString(source, index);
    return { end, text: decodeStringLiteral(source.slice(index, end)) ?? "" };
  }

  const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(index));
  if (!match) {
    return undefined;
  }
  return { end: index + match[0].length, text: match[0] };
}

function readValueEnd(source, index) {
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  for (let cursor = index; cursor < source.length; cursor += 1) {
    const next = consumeBoundary(source, cursor);
    if (next !== cursor) {
      cursor = next - 1;
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
  }
  return source.length;
}

function consumeTrailingComma(source, index) {
  let cursor = index;
  if (source[cursor] === ",") {
    cursor += 1;
  }
  while (source[cursor] === " " || source[cursor] === "\t") {
    cursor += 1;
  }
  if (source.startsWith("//", cursor)) {
    const newline = source.indexOf("\n", cursor);
    return newline === -1 ? source.length : newline;
  }
  return cursor;
}

export function findAssignedObject(source, name) {
  const declaration = new RegExp(`(?:export\\s+)?const\\s+${name}\\b`).exec(source);
  if (!declaration) {
    return undefined;
  }
  const equals = source.indexOf("=", declaration.index + declaration[0].length);
  if (equals === -1) {
    throw new Error(`No assignment for ${name}.`);
  }
  const brace = source.indexOf("{", equals);
  if (brace === -1) {
    throw new Error(`No object literal for ${name}.`);
  }
  return { start: brace, end: scanBalanced(source, brace, "{", "}") };
}

// Removes top-level properties whose predicate returns true. `removed` entries keep
// the property text (without the separating trivia) so callers can see which helpers
// the property referenced.
export function editNamedObject(source, name, shouldRemove) {
  const found = findAssignedObject(source, name);
  if (!found) {
    return { source, removed: [] };
  }

  const body = source.slice(found.start + 1, found.end);
  const edited = editObjectBody(body, shouldRemove);
  if (edited.removed.length === 0) {
    return { source, removed: [] };
  }

  return {
    source: `${source.slice(0, found.start + 1)}${edited.text}${source.slice(found.end)}`,
    removed: edited.removed,
  };
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
      const valueEnd = readValueEnd(body, index);
      const entryEnd = consumeTrailingComma(body, valueEnd);
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
      if (body[brace] !== "{") {
        throw new Error(`Method ${key.text} has no body.`);
      }
      valueEnd = scanBalanced(body, brace, "{", "}") + 1;
      valueStart = cursor;
    } else if (body[cursor] === ":") {
      valueStart = skipTrivia(body, cursor + 1);
      valueEnd = readValueEnd(body, valueStart);
    } else if (body[cursor] !== "," && body[cursor] !== "}" && cursor < body.length) {
      throw new Error(`Unexpected token after ${key.text}.`);
    }

    const entryEnd = consumeTrailingComma(body, valueEnd);
    const propertyText = body.slice(index, entryEnd);
    const valueText = body.slice(valueStart, valueEnd);
    if (shouldRemove({ key: key.text, value: valueText, text: propertyText })) {
      removed.push({ key: key.text, value: valueText, text: propertyText });
      index = entryEnd;
      continue;
    }

    text += body.slice(triviaStart, entryEnd);
    index = entryEnd;
  }

  return { text, removed };
}

export function removeArrayElements(source, shouldRemoveValue) {
  let text = "";
  let index = 0;
  while (index < source.length) {
    const next = consumeBoundary(source, index);
    if (next !== index) {
      text += source.slice(index, next);
      index = next;
      continue;
    }
    if (source[index] === "[") {
      const close = scanBalanced(source, index, "[", "]");
      const inner = removeArrayElements(source.slice(index + 1, close), shouldRemoveValue);
      const edited = editListBody(inner, shouldRemoveValue);
      text += `[${edited.text}]`;
      index = close + 1;
      continue;
    }
    text += source[index];
    index += 1;
  }
  return text;
}

export function editNamedSet(source, name, shouldRemoveValue) {
  const declaration = new RegExp(`(?:export\\s+)?const\\s+${name}\\b`).exec(source);
  if (!declaration) {
    return { source, removed: [] };
  }
  const bracket = source.indexOf("[", declaration.index);
  if (bracket === -1 || !source.slice(declaration.index, bracket).includes("new Set")) {
    return { source, removed: [] };
  }
  const close = scanBalanced(source, bracket, "[", "]");
  const edited = editListBody(source.slice(bracket + 1, close), shouldRemoveValue);
  if (edited.removed.length === 0) {
    return { source, removed: [] };
  }
  return {
    source: `${source.slice(0, bracket + 1)}${edited.text}${source.slice(close)}`,
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

export function removeImportSpecifiers(source, names) {
  if (names.size === 0) return source;
  let text = "";
  let index = 0;
  while (index < source.length) {
    const next = consumeBoundary(source, index);
    if (next !== index) {
      text += source.slice(index, next);
      index = next;
      continue;
    }
    if (source.startsWith("import", index) && !/[A-Za-z0-9_$]/.test(source[index + 6] ?? "")) {
      const end = statementEnd(source, index);
      text += rewriteImportSpecifiers(source.slice(index, end), names);
      index = end;
      continue;
    }
    text += source[index];
    index += 1;
  }
  return text;
}

function rewriteImportSpecifiers(statement, names) {
  const braceOpen = statement.indexOf("{");
  const braceClose = statement.lastIndexOf("}");
  if (braceOpen === -1 || braceClose === -1) return statement;
  const parts = statement
    .slice(braceOpen + 1, braceClose)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const kept = parts.filter((part) => {
    const local = part.split(/\s+as\s+/).pop()?.trim() ?? part;
    return !names.has(local);
  });
  if (kept.length === parts.length) return statement;
  if (kept.length === 0 && !/\bimport\s+[A-Za-z_$]/.test(statement.slice(0, braceOpen))) {
    return "";
  }
  const body = kept.length === 0 ? "" : ` ${kept.join(", ")} `;
  return `${statement.slice(0, braceOpen)}{${body}}${statement.slice(braceClose + 1)}`;
}

export function removeImportsFrom(source, specifierSuffix) {
  let text = "";
  let index = 0;
  let removed = false;
  while (index < source.length) {
    const next = consumeBoundary(source, index);
    if (next !== index) {
      text += source.slice(index, next);
      index = next;
      continue;
    }
    if (source.startsWith("import", index) && !/[A-Za-z0-9_$]/.test(source[index + 6] ?? "")) {
      const end = statementEnd(source, index);
      const statement = source.slice(index, end);
      if (statement.includes(specifierSuffix)) {
        removed = true;
        index = end;
        if (source[index] === "\n") index += 1;
        continue;
      }
    }
    text += source[index];
    index += 1;
  }
  return removed ? text : source;
}

function statementEnd(source, index) {
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  for (let cursor = index; cursor < source.length; cursor += 1) {
    const next = consumeBoundary(source, cursor);
    if (next !== cursor) {
      cursor = next - 1;
      continue;
    }
    const character = source[cursor];
    if (character === "(") paren += 1;
    else if (character === ")") paren -= 1;
    else if (character === "[") bracket += 1;
    else if (character === "]") bracket -= 1;
    else if (character === "{") brace += 1;
    else if (character === "}") brace -= 1;
    else if (character === ";" && paren === 0 && bracket === 0 && brace === 0) return cursor + 1;
  }
  return source.length;
}

export function replaceProviderTernary(source, id) {
  const pattern = new RegExp(`providerId\\s*===\\s*(["'])${id}\\1\\s*\\?`, "g");
  let text = "";
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const elseColon = findTernaryColon(source, match.index + match[0].length);
    if (elseColon === -1) {
      continue;
    }
    const elseEnd = findExpressionEnd(source, elseColon + 1);
    const elseExpression = source.slice(elseColon + 1, elseEnd).trim();
    text += source.slice(cursor, match.index) + elseExpression;
    cursor = elseEnd;
  }
  text += source.slice(cursor);
  return text;
}

function findTernaryColon(source, index) {
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let nested = 0;
  for (let cursor = index; cursor < source.length; cursor += 1) {
    const next = consumeBoundary(source, cursor);
    if (next !== cursor) {
      cursor = next - 1;
      continue;
    }
    const character = source[cursor];
    if (character === "(") paren += 1;
    else if (character === ")") {
      if (paren === 0) return -1;
      paren -= 1;
    } else if (character === "[") bracket += 1;
    else if (character === "]") bracket -= 1;
    else if (character === "{") brace += 1;
    else if (character === "}") brace -= 1;
    else if (character === "?" && paren === 0 && bracket === 0 && brace === 0) nested += 1;
    else if (character === ":" && paren === 0 && bracket === 0 && brace === 0) {
      if (nested === 0) return cursor;
      nested -= 1;
    } else if ((character === ";" || character === "\n") && paren === 0 && bracket === 0 && brace === 0) {
      return -1;
    }
  }
  return -1;
}

function findExpressionEnd(source, index) {
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let cursor = skipTrivia(source, index);
  while (cursor < source.length) {
    const next = consumeBoundary(source, cursor);
    if (next !== cursor) {
      cursor = next;
      continue;
    }
    const character = source[cursor];
    if (character === "(") paren += 1;
    else if (character === ")") {
      if (paren === 0) return cursor;
      paren -= 1;
    } else if (character === "[") bracket += 1;
    else if (character === "]") {
      if (bracket === 0) return cursor;
      bracket -= 1;
    } else if (character === "{") brace += 1;
    else if (character === "}") {
      if (brace === 0) return cursor;
      brace -= 1;
    } else if ((character === ";" || character === "," || character === "\n") && paren === 0 && bracket === 0 && brace === 0) {
      return cursor;
    }
    cursor += 1;
  }
  return cursor;
}

export function removeUnionMember(source, typeName, member) {
  const declaration = new RegExp(`(?:export\\s+)?type\\s+${typeName}\\b`).exec(source);
  if (!declaration) return source;
  const line = new RegExp(`^\\s*\\|\\s*["']${member}["']\\s*$`, "m");
  const sliceFrom = source.slice(declaration.index);
  const match = line.exec(sliceFrom);
  if (!match) return source;
  const start = declaration.index + match.index;
  let end = start + match[0].length;
  if (source[end] === "\n") end += 1;
  return source.slice(0, start) + source.slice(end);
}

export function removeFunctionDeclaration(source, name) {
  const match = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\b`).exec(source);
  if (!match) return source;
  let start = match.index;
  while (start > 0 && source[start - 1] !== "\n") start -= 1;
  const paren = source.indexOf("(", match.index);
  const parenEnd = scanBalanced(source, paren, "(", ")");
  const brace = skipTrivia(source, parenEnd + 1);
  if (source[brace] !== "{") {
    throw new Error(`function ${name} has no body.`);
  }
  let end = scanBalanced(source, brace, "{", "}") + 1;
  if (source[end] === "\n") end += 1;
  return source.slice(0, start) + source.slice(end);
}

function isCommentOnly(trivia) {
  const withoutLine = trivia.replace(/\/\/[^\n]*/g, "");
  const withoutBlock = withoutLine.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlock.trim() === "";
}

function isBlockStart(statementSoFar) {
  const trimmed = statementSoFar.trim();
  if (trimmed.endsWith("=>")) return true;
  return /^(?:export\s+)?(?:async\s+)?(?:function|class)\b|^(?:if|for|while|else|do|try|catch|finally)\b/.test(trimmed);
}

function readStatement(source, index, limit, ctx) {
  let paren = 0;
  let bracket = 0;
  let text = "";
  const removedTexts = [];
  let cursor = index;
  while (cursor < limit) {
    const next = consumeBoundary(source, cursor);
    if (next !== cursor) {
      text += source.slice(cursor, next);
      cursor = next;
      continue;
    }
    const character = source[cursor];
    if (character === "(") {
      paren += 1;
      text += character;
      cursor += 1;
      continue;
    }
    if (character === ")") {
      paren -= 1;
      text += character;
      cursor += 1;
      continue;
    }
    if (character === "[") {
      bracket += 1;
      text += character;
      cursor += 1;
      continue;
    }
    if (character === "]") {
      bracket -= 1;
      text += character;
      cursor += 1;
      continue;
    }
    if (character === "{") {
      const close = scanBalanced(source, cursor, "{", "}");
      if (isBlockStart(text)) {
        const inner = transformRange(source, cursor + 1, close, ctx);
        removedTexts.push(...inner.removedTexts);
        text += `{${inner.text}}`;
      } else {
        text += source.slice(cursor, close + 1);
      }
      cursor = close + 1;
      if (isBlockStart(text.slice(0, text.lastIndexOf("{"))) && paren === 0 && bracket === 0) {
        if (source[cursor] === ";") {
          text += ";";
          cursor += 1;
        }
        return { end: cursor, text, removedTexts };
      }
      continue;
    }
    if (character === ";" && paren === 0 && bracket === 0) {
      text += ";";
      return { end: cursor + 1, text, removedTexts };
    }
    text += character;
    cursor += 1;
  }
  return { end: cursor, text, removedTexts };
}

function transformRange(source, start, end, ctx) {
  let text = "";
  const removedTexts = [];
  let index = start;
  while (index < end) {
    const triviaStart = index;
    index = skipTrivia(source, index);
    if (index >= end) {
      text += source.slice(triviaStart, end);
      break;
    }
    const statement = readStatement(source, index, end, ctx);
    removedTexts.push(...statement.removedTexts);
    const transformed = transformStatement(statement.text, ctx);
    if (transformed === null) {
      removedTexts.push(statement.text);
      const trivia = source.slice(triviaStart, index);
      if (trivia.trim() !== "" && !isCommentOnly(trivia)) {
        text += trivia;
      }
    } else {
      text += source.slice(triviaStart, index) + transformed;
    }
    index = statement.end;
  }
  return { text, removedTexts };
}

function conditionOf(statement) {
  const open = statement.indexOf("(");
  if (open === -1) return "";
  try {
    const close = scanBalanced(statement, open, "(", ")");
    return statement.slice(open, close + 1);
  } catch {
    return "";
  }
}

function removedIdSet(ctx) {
  return ctx.removedIds ?? new Set([ctx.id]);
}

function isRemovedProviderIf(statement, ctx) {
  const trimmed = statement.trim();
  if (!/^if\b/.test(trimmed) || trimmed.includes("||")) return false;
  const removed = removedIdSet(ctx);
  const ids = stringLiterals(conditionOf(trimmed)).filter((value) => ctx.knownIds.has(value));
  return ids.length > 0 && ids.every((value) => removed.has(value));
}

function suiteBody(statement) {
  if (!/^\s*(?:it|test|describe)\s*\(/.test(statement)) return undefined;
  const arrow = statement.indexOf("=>");
  if (arrow === -1) return undefined;
  const brace = statement.indexOf("{", arrow);
  if (brace === -1) return undefined;
  try {
    const end = scanBalanced(statement, brace, "{", "}");
    return statement.slice(brace + 1, end);
  } catch {
    return undefined;
  }
}

function isEmptySuite(statement) {
  if (!/^\s*(?:it|test|describe)\s*\(/.test(statement)) return false;
  const body = suiteBody(statement);
  if (body === undefined) return false;
  if (/^\s*describe\s*\(/.test(statement)) return !/\b(?:it|test)\s*\(/.test(body);
  return body.trim() === "";
}

function isDeclaration(statement) {
  return /^\s*(?:export\s+)?(?:async\s+)?(?:const|let|var|function|class|type|interface|enum)\b/.test(statement);
}

function isExpectStatement(statement) {
  return /^\s*(?:await\s+)?expect(?:\.[\w]+)?\s*\(/.test(statement);
}

function mentionsOnlyRemovedIds(statement, ctx) {
  const ids = stringLiterals(statement).filter((value) => ctx.knownIds.has(value));
  return ids.length > 0 && ids.every((value) => removedIdSet(ctx).has(value));
}

function isDroppedDeclaration(statement, name) {
  if (!name || !isDeclaration(statement)) return false;
  return new RegExp(`(?:function|const|let|var|class|type|interface|enum)\\s+${name}\\b`).test(statement);
}

function statementReferencesBinding(statement, bindings) {
  for (const name of bindings) {
    if (countIdentifiers(statement, name) > 0) return true;
  }
  return false;
}

function isEmptyBlockStatement(statement) {
  if (!/^\s*(?:for|while|if)\b/.test(statement)) return false;
  const brace = statement.indexOf("{");
  if (brace === -1) return false;
  try {
    const end = scanBalanced(statement, brace, "{", "}");
    return statement.slice(brace + 1, end).trim() === "";
  } catch {
    return false;
  }
}

function isRemovedProviderTest(statement, ctx) {
  if (!/^\s*(?:it|test)\s*\(/.test(statement)) return false;
  return mentionsOnlyRemovedIds(statement, ctx);
}

function transformStatement(statement, ctx) {
  if (isDroppedDeclaration(statement, ctx.dropDeclaration)) return null;
  if (isRemovedProviderIf(statement, ctx)) return null;
  if (isEmptyBlockStatement(statement) || isEmptySuite(statement) || isRemovedProviderTest(statement, ctx)) return null;
  if (isDeclaration(statement) || /^\s*import\b/.test(statement)) return statement;
  if (statementReferencesBinding(statement, ctx.dropBindings)) return null;
  if (isExpectStatement(statement) && mentionsOnlyRemovedIds(statement, ctx)) return null;
  return statement;
}

export function transformSource(source, ctx) {
  return transformRange(source, 0, source.length, {
    id: ctx.id,
    knownIds: ctx.knownIds ?? new Set(),
    dropBindings: ctx.dropBindings ?? new Set(),
    dropDeclaration: ctx.dropDeclaration,
    removedIds: ctx.removedIds,
  });
}

export function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

export function literalLocations(source, value) {
  const lines = [];
  for (let index = 0; index < source.length; index += 1) {
    const next = consumeBoundary(source, index);
    if (next !== index) {
      if (
        (source[index] === '"' || source[index] === "'" || source[index] === "`") &&
        decodeStringLiteral(source.slice(index, next)) === value
      ) {
        lines.push(lineOf(source, index));
      }
      index = next - 1;
    }
  }
  return lines;
}
