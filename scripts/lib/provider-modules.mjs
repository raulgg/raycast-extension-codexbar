import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const PROVIDER_INDEX_PATH = "src/providers/index.ts";

const MODULE_INDEX = /^src\/providers\/([^/]+)\/index\.ts$/;
const MODULE_BINDING = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// Catalog id order. Not alphabetical. Emitted into src/providers/index.ts.
export const CATALOG_PROVIDER_ORDER = [
  "codex",
  "claude",
  "clinepass",
  "cursor",
  "opencode",
  "opencodego",
  "alibaba",
  "factory",
  "fireworks",
  "gemini",
  "antigravity",
  "copilot",
  "zai",
  "minimax",
  "kimi",
  "kilo",
  "kiro",
  "vertexai",
  "augment",
  "jetbrains",
  "amp",
  "ollama",
  "synthetic",
  "warp",
  "openrouter",
  "perplexity",
  "openai",
  "azureopenai",
  "alibabatokenplan",
  "qwencloud",
  "manus",
  "moonshot",
  "t3chat",
  "elevenlabs",
  "windsurf",
  "mimo",
  "doubao",
  "abacus",
  "mistral",
  "deepseek",
  "deepinfra",
  "codebuff",
  "venice",
  "commandcode",
  "stepfun",
  "bedrock",
  "grok",
  "groq",
  "llmproxy",
  "deepgram",
  "devin",
  "zed",
  "sakana",
  "qoder",
  "litellm",
  "poe",
  "chutes",
  "neuralwatt",
  "clawrouter",
  "wayfinder",
  "longcat",
  "sub2api",
  "zenmux",
  "aiand",
  "xai",
  "notion",
  "ibmbob",
  "atlascloud",
  "bifrost",
  "coderabbit",
  "devpass",
  "gitkraken",
  "helmcode",
  "huggingface",
  "hyper",
  "llmman",
  "muse",
  "nous",
  "pi",
  "replicate",
  "typesafe",
  "v0",
  "vercel",
  "zoommate",
];

export function providerModuleIdsFromFiles(files) {
  const ids = new Set();
  for (const filePath of Object.keys(files)) {
    if (files[filePath] === undefined) continue;
    const match = MODULE_INDEX.exec(filePath);
    if (match) ids.add(match[1]);
  }
  return [...ids].sort();
}

export function renderProviderIndex(ids) {
  const unique = [...new Set(ids)].sort();
  for (const id of unique) {
    if (!MODULE_BINDING.test(id)) {
      throw new Error(`Provider directory "${id}" is not a valid module binding.`);
    }
  }

  const knownOrder = new Set(CATALOG_PROVIDER_ORDER);
  const missingFromOrder = unique.filter((id) => !knownOrder.has(id));
  if (missingFromOrder.length > 0) {
    throw new Error(`Provider directories missing from catalog order: ${missingFromOrder.join(", ")}`);
  }

  const idSet = new Set(unique);
  const order = CATALOG_PROVIDER_ORDER.filter((id) => idSet.has(id));
  const header = `import { assembleProviderCatalog, providerIdAliases, type ProviderModule } from "./module";\n`;
  const imports = unique.length === 0 ? "" : `${unique.map((id) => `import ${id} from "./${id}";`).join("\n")}\n`;
  const modules =
    unique.length === 0
      ? "export const PROVIDER_MODULES = {} satisfies Record<string, ProviderModule>;\n"
      : `export const PROVIDER_MODULES = {\n${unique.map((id) => `  ${id},`).join("\n")}\n} satisfies Record<string, ProviderModule>;\n`;
  const orderEntries = order.length === 0 ? "" : `\n${order.map((id) => `  "${id}",`).join("\n")}\n`;
  const catalog = [
    `const CATALOG_PROVIDER_ORDER = [${orderEntries}] as const;`,
    "",
    "export const PROVIDER_CATALOG = assembleProviderCatalog(CATALOG_PROVIDER_ORDER, PROVIDER_MODULES);",
    "",
    "export const PROVIDER_ID_ALIASES = providerIdAliases(PROVIDER_MODULES);",
    "",
  ].join("\n");

  return `${header}${imports}\n${modules}\n${catalog}`;
}

export async function listProviderModuleIds(root) {
  const directory = path.join(root, "src/providers");
  const entries = await readdir(directory, { withFileTypes: true });
  const ids = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const children = await readdir(path.join(directory, entry.name));
    if (children.includes("index.ts")) ids.push(entry.name);
  }
  ids.sort();
  return ids;
}

export async function checkProviderModuleIndex(root) {
  const ids = await listProviderModuleIds(root);
  const expected = renderProviderIndex(ids);
  const actual = await readFile(path.join(root, PROVIDER_INDEX_PATH), "utf8");
  if (actual === expected) return [];
  return [`${PROVIDER_INDEX_PATH} does not match the provider directories.`];
}
