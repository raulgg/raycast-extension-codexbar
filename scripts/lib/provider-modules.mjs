import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const PROVIDER_INDEX_PATH = "src/providers/index.ts";

const MODULE_INDEX = /^src\/providers\/([^/]+)\/index\.ts$/;
const MODULE_BINDING = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

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

  const header = `import type { ProviderModule } from "./module";\n`;
  if (unique.length === 0) {
    return `${header}\nexport const PROVIDER_MODULES = {} satisfies Record<string, ProviderModule>;\n`;
  }

  const imports = unique.map((id) => `import ${id} from "./${id}";`).join("\n");
  const entries = unique.map((id) => `  ${id},`).join("\n");
  return `${header}${imports}\n\nexport const PROVIDER_MODULES = {\n${entries}\n} satisfies Record<string, ProviderModule>;\n`;
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
