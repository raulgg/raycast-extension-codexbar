#!/usr/bin/env node

// Deletes Providers that the pinned CodexBar revision no longer ships.
// The edit is the Provider directory, the generated module index, the catalog
// order, the upstream allowlists, and an icon no remaining Provider uses.
// A production reference that would survive that edit blocks the write.
//
//   npm run upstream:prune
//   npm run upstream:prune -- --check
//   npm run upstream:prune -- --plan

import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PROVIDER_CATALOG } from "../src/providers/index.ts";
import { planPrune } from "./lib/prune-provider.mjs";
import { createUpstreamSource, isMainModule, readFilesWithConcurrency } from "./lib/upstream.mjs";
import { parseDescriptorMetadata } from "./lib/upstream-metadata.mjs";
import { assertSafeIconSlug } from "./sync-provider-icons.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESCRIPTOR_DIR = "Sources/CodexBarCore/Providers";
const SOURCE_ROOTS = ["src", "scripts"];

export function pruneMode(argv) {
  if (argv.includes("--plan")) return "plan";
  if (argv.includes("--check")) return "check";
  return "apply";
}

export function planSummary(plan) {
  return {
    ok: plan.ok,
    updates: plan.updates,
    deleted: plan.deleted,
    blockers: plan.blockers,
    testMentions: plan.testMentions,
  };
}

export async function executePrune({ mode, files, removed, writeFile: write, remove }) {
  const plan = planPrune(files, removed);
  if (mode === "plan") {
    return { plan, wrote: false, stdout: `${JSON.stringify(planSummary(plan))}\n`, stderr: humanReport(removed, plan) };
  }
  if (mode !== "apply" || !plan.ok) {
    return { plan, wrote: false, stdout: humanReport(removed, plan), stderr: "" };
  }

  for (const relative of plan.updates) {
    await write(relative, plan.files[relative]);
  }
  for (const relative of plan.deleted) {
    await remove(relative);
  }
  for (const directory of providerDirectories(plan.deleted)) {
    await remove(directory, { recursive: true });
  }
  return { plan, wrote: true, stdout: humanReport(removed, plan), stderr: "" };
}

function humanReport(removed, plan) {
  const lines = [`Upstream no longer ships: ${removed.map((provider) => provider.id).join(", ")}`];
  for (const relative of [...plan.updates, ...plan.deleted]) lines.push(relative);
  if (plan.testMentions.length > 0) {
    lines.push("Tests still mention a removed Provider:");
    for (const mention of plan.testMentions) lines.push(`  ${mention}`);
  }
  if (plan.blockers.length > 0) {
    lines.push("Removed Providers are still referenced from production code:");
    for (const mention of plan.blockers) lines.push(`  ${mention}`);
  }
  return `${lines.join("\n")}\n`;
}

function providerDirectories(deleted) {
  return [
    ...new Set(
      deleted
        .map((relative) => relative.match(/^(src\/providers\/[^/]+)\//)?.[1])
        .filter((directory) => directory !== undefined),
    ),
  ];
}

async function listSourceFiles(directory) {
  const entries = await readdir(path.join(ROOT, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(entryPath)));
      continue;
    }
    if (/\.(tsx?|mjs)$/.test(entry.name)) files.push(entryPath);
  }
  return files;
}

async function upstreamProviderIds(source) {
  const descriptorPaths = (await source.listFiles(DESCRIPTOR_DIR, "ProviderDescriptor.swift")).filter(
    (filePath) => !filePath.endsWith("/ProviderDescriptor.swift"),
  );
  if (descriptorPaths.length === 0) {
    throw new Error(`No provider descriptors found under ${DESCRIPTOR_DIR} in ${source.label}.`);
  }
  const descriptorFiles = await readFilesWithConcurrency(source, descriptorPaths);
  const ids = new Set();
  for (const file of descriptorFiles) {
    ids.add(parseDescriptorMetadata(file.content, file.path).id);
  }
  return ids;
}

async function readProjectSources() {
  const files = {};
  for (const root of SOURCE_ROOTS) {
    for (const relative of await listSourceFiles(root)) {
      files[relative] = await readFile(path.join(ROOT, relative), "utf8");
    }
  }
  return files;
}

async function prune() {
  const source = await createUpstreamSource();
  const upstreamIds = await upstreamProviderIds(source);
  const removed = Object.keys(PROVIDER_CATALOG)
    .filter((id) => !upstreamIds.has(id))
    .sort()
    .map((id) => ({ id, iconSlug: assertSafeIconSlug(PROVIDER_CATALOG[id].iconSlug) }));

  if (removed.length === 0) {
    const mode = pruneMode(process.argv);
    if (mode === "plan") {
      process.stdout.write(`${JSON.stringify(planSummary({ ok: true, updates: [], deleted: [], blockers: [], testMentions: [] }))}\n`);
      return;
    }
    console.log(`No removed providers in ${source.label}.`);
    return;
  }

  const files = await readProjectSources();
  const mode = pruneMode(process.argv);
  const result = await executePrune({
    mode,
    files,
    removed,
    writeFile: (relative, contents) => writeFile(path.join(ROOT, relative), contents),
    remove: (relative, options) => rm(path.join(ROOT, relative), { force: true, ...options }),
  });

  if (mode === "plan") {
    process.stderr.write(result.stderr);
    process.stdout.write(result.stdout);
    if (!result.plan.ok) process.exitCode = 1;
    return;
  }

  process.stdout.write(result.stdout);
  if (!result.plan.ok || mode === "check") process.exitCode = 1;
}

if (isMainModule(import.meta.url)) {
  prune().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
