import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

function tsSpecifier(specifier, parentURL) {
  if (!parentURL?.startsWith("file:")) return undefined;
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return undefined;
  if (path.extname(specifier) !== "") return undefined;

  const base = path.resolve(path.dirname(fileURLToPath(parentURL)), specifier);
  if (existsSync(`${base}.ts`)) return `${specifier}.ts`;
  if (existsSync(path.join(base, "index.ts"))) return `${specifier}/index.ts`;
  return undefined;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(tsSpecifier(specifier, context.parentURL) ?? specifier, context);
  },
});
