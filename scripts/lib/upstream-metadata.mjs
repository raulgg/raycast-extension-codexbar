// Pure parsing and comparison logic for scripts/check-upstream.mjs, kept side-effect
// free so scripts/check-upstream.test.mjs can exercise it against fixture strings.
//
// The extension catalog is imported as data. Upstream descriptors are parsed with
// regexes over stable formatting. Every parser throws when the shape drifts, so a
// format change fails the check instead of verifying less.

// ---------------------------------------------------------------------------
// Upstream descriptors (Sources/CodexBarCore/Providers/**/…ProviderDescriptor.swift)
// ---------------------------------------------------------------------------

// ProviderColor components are written as `16 / 255`, `0.06`, `1.0`, or `0`,
// possibly split across lines. Convert to the catalog's #RRGGBB form.
export function providerColorToHex(red, green, blue) {
  const channel = (expression) => {
    const match = expression.trim().match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*255)?$/);
    if (!match) {
      throw new Error(`Unrecognized ProviderColor component: "${expression}"`);
    }
    const value = expression.includes("/") ? Number(match[1]) : Number(match[1]) * 255;
    return Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase();
}

export function extractBalancedCall(source, callee, fileName) {
  const match = source.match(new RegExp(`(?<![\\w])${callee}\\(`));
  if (!match) {
    return undefined;
  }

  const open = match.index + match[0].length - 1;
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open + 1, index);
      }
    }
  }

  throw new Error(`${fileName} has an unbalanced ${callee}( literal.`);
}

function parseColorBody(colorBody, fileName) {
  const hexMatch = colorBody.match(/^hex:\s*0x([0-9A-Fa-f]{6})$/);
  if (hexMatch) {
    return `#${hexMatch[1].toUpperCase()}`;
  }

  const rgbMatch = colorBody.match(/red:\s*([^,]+),\s*green:\s*([^,]+),\s*blue:\s*([^)]+)/);
  if (!rgbMatch) {
    throw new Error(`${fileName} has an unrecognized ProviderColor: "${colorBody}"`);
  }

  return providerColorToHex(rgbMatch[1], rgbMatch[2], rgbMatch[3]);
}

// ProviderBranding uses `color: ProviderColor(...)`. PluginProviderSpec uses that
// or `color: .init(...)`. `(?<![\w])` skips `widgetColor`.
function parseBrandColor(source, fileName) {
  const colorBody = source.match(/(?<![\w])color:\s*(?:ProviderColor|\.init)\(([\s\S]*?)\)/)?.[1]?.trim();
  if (!colorBody) {
    throw new Error(`${fileName} has no parseable branding color.`);
  }
  return parseColorBody(colorBody, fileName);
}

function countCalls(source, callee) {
  return source.split(`${callee}(`).length - 1;
}

function readDescriptorFields(body, fileName) {
  const id = body.match(/^\s*id:\s*\.(\w+)/)?.[1];
  if (!id) {
    throw new Error(`${fileName} has no parseable provider id.`);
  }

  const string = (name) => body.match(new RegExp(`(?<![\\w])${name}:\\s*"([^"]*)"`))?.[1];
  // URL fields are sometimes Swift expressions (e.g. `ZaiAPIRegion.global.dashboardURL
  // .absoluteString`) that a regex cannot resolve. Record them as "expr:<code>" so the
  // comparison demands an explicit ALLOWED_DIVERGENCES entry for the manually verified
  // value. That entry goes stale, and fails, if the upstream expression changes.
  const stringOrExpression = (name) => {
    const raw = body.match(new RegExp(`(?<![\\w])${name}:\\s*([^\\n,]+)`))?.[1]?.trim();
    if (raw === undefined) {
      return undefined;
    }
    const literal = raw.match(/^"([^"]*)"/);
    if (literal) {
      return literal[1];
    }
    // Values at the end of the init call carry closing parens, e.g. `statusLinkURL: nil)`.
    const expression = raw.replace(/\)+$/, "").trim();
    return expression === "nil" || expression === "" ? undefined : `expr:${expression}`;
  };

  return {
    id,
    displayName: string("displayName"),
    sessionLabel: string("sessionLabel"),
    weeklyLabel: string("weeklyLabel"),
    opusLabel: string("opusLabel"),
    dashboardURL: stringOrExpression("dashboardURL"),
    subscriptionDashboardURL: stringOrExpression("subscriptionDashboardURL"),
    statusPageURL: stringOrExpression("statusPageURL"),
    statusLinkURL: stringOrExpression("statusLinkURL"),
  };
}

function dynamicLabelFlags(swiftSource) {
  return {
    // Descriptors that define a contextual label helper participate in dynamic
    // relabelling even before any renderer references them.
    definesDynamicPrimaryLabel: /static func primaryLabel\(/.test(swiftSource),
    definesRateWindowLabeler: /rateWindowLabeler\s*:/.test(swiftSource),
  };
}

export function parseDescriptorMetadata(swiftSource, fileName = "descriptor") {
  const metadataCount = countCalls(swiftSource, "ProviderMetadata");
  const specCount = countCalls(swiftSource, "PluginProviderSpec");
  if (metadataCount + specCount !== 1) {
    throw new Error(
      `${fileName} contains ${metadataCount} ProviderMetadata literals and ${specCount} PluginProviderSpec literals; expected exactly one.`,
    );
  }

  if (metadataCount === 1) {
    const metadata = extractBalancedCall(swiftSource, "ProviderMetadata", fileName);
    if (!metadata) {
      throw new Error(`${fileName} has no extractable ProviderMetadata literal.`);
    }
    const branding = extractBalancedCall(swiftSource, "ProviderBranding", fileName);
    if (!branding) {
      throw new Error(`${fileName} has no parseable ProviderBranding literal.`);
    }
    return {
      ...readDescriptorFields(metadata, fileName),
      brandColorHex: parseBrandColor(branding, fileName),
      ...dynamicLabelFlags(swiftSource),
    };
  }

  const spec = extractBalancedCall(swiftSource, "PluginProviderSpec", fileName);
  if (!spec) {
    throw new Error(`${fileName} has no extractable PluginProviderSpec literal.`);
  }
  return {
    ...readDescriptorFields(spec, fileName),
    brandColorHex: parseBrandColor(spec, fileName),
    ...dynamicLabelFlags(swiftSource),
  };
}

// Module `aliases` in src/providers/<id>/index.ts are the CLI spellings, not the raw
// descriptor array. cliName is included when it is not the id. The id is left out:
// an alias that is a provider id fails the collision check.
export function expectedModuleAliases(id, cliName, aliases) {
  const expected = [];
  if (cliName && cliName !== id) {
    expected.push(cliName);
  }
  for (const alias of aliases) {
    if (alias === id || alias === cliName || expected.includes(alias)) {
      continue;
    }
    expected.push(alias);
  }
  return expected;
}

function skipAliasNoise(source, index) {
  while (index < source.length) {
    if (/[\s,]/.test(source[index])) {
      index += 1;
      continue;
    }
    if (source.startsWith("//", index)) {
      const newline = source.indexOf("\n", index);
      index = newline === -1 ? source.length : newline + 1;
      continue;
    }
    if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      if (end === -1) {
        return -1;
      }
      index = end + 2;
      continue;
    }
    break;
  }
  return index;
}

function readAliasArray(source, fileName) {
  const keys = [...source.matchAll(/(?<![\w])aliases\s*:/g)];
  if (keys.length > 1) {
    return { error: `${fileName} has ${keys.length} aliases arrays; expected one string array.` };
  }
  if (keys.length === 0) {
    return { aliases: [] };
  }

  let index = skipAliasNoise(source, keys[0].index + keys[0][0].length);
  if (index < 0 || source[index] !== "[") {
    return { error: `${fileName} aliases is not a string array literal.` };
  }
  index += 1;
  const aliases = [];
  while (index < source.length) {
    index = skipAliasNoise(source, index);
    if (index < 0) {
      return { error: `${fileName} aliases is not a string array literal.` };
    }
    if (source[index] === "]") {
      return { aliases };
    }
    if (source[index] !== '"') {
      return { error: `${fileName} aliases is not a string array literal.` };
    }
    index += 1;
    let value = "";
    while (index < source.length && source[index] !== '"') {
      if (source[index] === "\\") {
        return { error: `${fileName} aliases is not a string array literal.` };
      }
      value += source[index];
      index += 1;
    }
    if (source[index] !== '"') {
      return { error: `${fileName} aliases is not a string array literal.` };
    }
    index += 1;
    aliases.push(value);
  }
  return { error: `${fileName} aliases is not a string array literal.` };
}

function readCliName(source, id, fileName) {
  const matches = [...source.matchAll(/(?<![\w])cliName\s*:\s*([^\n,]+)/g)];
  if (matches.length > 1) {
    return { error: `${fileName} has ${matches.length} cliName values; expected one.` };
  }
  if (matches.length === 0) {
    return { cliName: id };
  }
  const raw = matches[0][1].trim().replace(/\)+$/, "").trim();
  const literal = raw.match(/^"([^"]*)"$/);
  if (!literal) {
    return { error: `${fileName} cliName is not a string literal.` };
  }
  return { cliName: literal[1] };
}

export function parseDescriptorCliAliases(source, id, fileName) {
  const parsed = readAliasArray(source, fileName);
  if (parsed.error) {
    return { id, fileName, error: parsed.error };
  }
  const cliName = readCliName(source, id, fileName);
  if (cliName.error) {
    return { id, fileName, error: cliName.error };
  }
  return { id, fileName, cliName: cliName.cliName, aliases: parsed.aliases };
}

export function descriptorAliasProblems(descriptors, modules = {}) {
  const problems = [];
  for (const descriptor of descriptors) {
    if (descriptor.error) {
      problems.push(descriptor.error);
      continue;
    }
    const expected = expectedModuleAliases(descriptor.id, descriptor.cliName, descriptor.aliases);
    const actual = Array.isArray(modules[descriptor.id]?.aliases) ? modules[descriptor.id].aliases : [];
    if (actual.length !== expected.length || actual.some((alias, index) => alias !== expected[index])) {
      problems.push(
        `${descriptor.fileName}: ${descriptor.id} aliases ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`,
      );
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Dynamic label overrides (renderer call sites)
// ---------------------------------------------------------------------------

// Overrides show up in three shapes across the GUI/widget/CLI renderers:
//   - `XxxProviderDescriptor.primaryLabel(...)` / `.displayLabel(...)` calls
//   - `provider == .xxx` conditionals inside rateWindowLabels-style helpers
//     (factory tertiary, cursor legacy requests)
//   - `descriptor.presentation.rateWindowLabels(...)`. CLI renderers that
//     delegate to each descriptor's presentation labeler (v0.53+)
//
// Known blind spots of this heuristic (a Swift parser is not worth it):
// a `provider == .x` conditional in a function other than rateWindowLabels stays
// invisible while the file's other call sites keep the scan green, and a `" func "`
// token inside the rateWindowLabels body (comment, nested closure) truncates the
// scanned region early. Deleted or renamed files fail via read errors.
export function parseDynamicOverrideProviders(rendererSources) {
  const providers = new Set();
  for (const { path: filePath, content } of rendererSources) {
    for (const match of content.matchAll(/(\w+)ProviderDescriptor\.(?:primaryLabel|displayLabel)\(/g)) {
      providers.add(match[1].toLowerCase());
    }

    const labelsStart = content.indexOf("func rateWindowLabels(");
    if (labelsStart !== -1) {
      const nextFunc = content.indexOf(" func ", labelsStart + "func rateWindowLabels(".length);
      const body = content.slice(labelsStart, nextFunc === -1 ? undefined : nextFunc);
      for (const match of body.matchAll(/provider == \.(\w+)/g)) {
        providers.add(match[1]);
      }
    } else if (
      !/ProviderDescriptor\.(?:primaryLabel|displayLabel)\(/.test(content) &&
      !/presentation\.rateWindowLabels\(/.test(content)
    ) {
      throw new Error(
        `${filePath} has neither rateWindowLabels, primaryLabel/displayLabel, nor presentation.rateWindowLabels call sites. Did upstream move them?`,
      );
    }
  }
  return providers;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

// Upstream expresses "no value" as nil or ""; the catalog omits the property.
const same = (catalogValue, upstreamValue) => (catalogValue ?? "") === (upstreamValue ?? "");

function fieldRules(upstream) {
  return [
    ["name", upstream.displayName],
    ["usageSectionLabels.primary", upstream.sessionLabel],
    ["usageSectionLabels.secondary", upstream.weeklyLabel],
    ["usageSectionLabels.tertiary", upstream.opusLabel],
    ["dashboardUrl", upstream.dashboardURL],
    ["subscriptionDashboardUrl", upstream.subscriptionDashboardURL],
    // The extension only ever opens this URL in a browser, so upstream's
    // browser-only statusLinkURL is the correct fallback for it.
    ["statusPageUrl", upstream.statusPageURL ?? upstream.statusLinkURL],
    ["brandColor", upstream.brandColorHex, (a, b) => (a ?? "").toUpperCase() === (b ?? "").toUpperCase()],
  ];
}

function catalogFieldValue(entry, field) {
  return field.startsWith("usageSectionLabels.")
    ? entry.usageSectionLabels[field.slice("usageSectionLabels.".length)]
    : entry[field];
}

// allowedDivergences: { providerId: { field: { ours, upstream, reason } } }.
// An entry only suppresses the exact recorded pair; when either side moves (including
// into agreement) the entry is reported as stale so it gets re-reviewed and removed.
export function compareProviders(catalog, upstreamById, allowedDivergences = {}) {
  const catalogEntries = Object.entries(catalog);
  if (catalogEntries.length === 0) {
    throw new Error("PROVIDER_CATALOG is empty.");
  }

  const problems = [];
  const usedAllowances = new Set();

  for (const [id, entry] of catalogEntries) {
    const upstream = upstreamById.get(id);
    if (!upstream) {
      problems.push(
        `${id}: present in the provider catalog but has no upstream descriptor (renamed or removed upstream?)`,
      );
      continue;
    }

    for (const [field, upstreamValue, equals = same] of fieldRules(upstream)) {
      const catalogValue = catalogFieldValue(entry, field);
      const allowance = allowedDivergences[id]?.[field];
      if (allowance) {
        usedAllowances.add(`${id}.${field}`);
        if (same(catalogValue, allowance.ours) && same(upstreamValue, allowance.upstream)) {
          continue;
        }
        problems.push(
          `${id}: stale ALLOWED_DIVERGENCES entry for ${field}. Recorded ours="${allowance.ours}" upstream="${allowance.upstream}", ` +
            `actual ours="${catalogValue}" upstream="${upstreamValue}". Re-review and update or delete it.`,
        );
        continue;
      }
      if (!equals(catalogValue, upstreamValue)) {
        problems.push(`${id}: ${field} "${catalogValue}" != upstream "${upstreamValue}"`);
      }
    }
  }

  for (const id of upstreamById.keys()) {
    if (!Object.hasOwn(catalog, id)) {
      problems.push(`${id}: upstream provider missing from the provider catalog`);
    }
  }

  for (const [id, fields] of Object.entries(allowedDivergences)) {
    for (const field of Object.keys(fields)) {
      if (!usedAllowances.has(`${id}.${field}`)) {
        problems.push(`${id}: ALLOWED_DIVERGENCES entry for ${field} matched no comparison. Delete it.`);
      }
    }
  }

  return problems;
}
