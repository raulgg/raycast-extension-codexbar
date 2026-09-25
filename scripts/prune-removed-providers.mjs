#!/usr/bin/env node

// Deletes providers that the pinned CodexBar revision no longer ships.
// Catalog entries, aliases, mocks, pace rows, dynamic titles, allowlists, provider
// rules, exclusive tests, and icons are removed together. Shared tests that use the
// id as one sample among several are listed and left in place.
//
//   npm run upstream:prune
//   npm run upstream:prune -- --check

import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PROVIDER_CATALOG } from "../src/providers/catalog.ts";
import { keptIconSlugs, pruneProviderSources } from "./lib/prune-provider.mjs";
import { createUpstreamSource, isMainModule, readFilesWithConcurrency } from "./lib/upstream.mjs";
import { parseDescriptorMetadata } from "./lib/upstream-metadata.mjs";
import { assertSafeIconSlug } from "./sync-provider-icons.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_ONLY = process.argv.includes("--check");
const DESCRIPTOR_DIR = "Sources/CodexBarCore/Providers";
const SOURCE_ROOTS = ["src", "scripts"];

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
    if (/\.(tsx?|mjs)$/.test(entry.name)) {
      files.push(entryPath);
    }
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
    .sort();

  if (removed.length === 0) {
    console.log(`No removed providers in ${source.label}.`);
    return;
  }

  console.log(`Upstream no longer ships: ${removed.join(", ")}`);
  if (CHECK_ONLY) {
    process.exitCode = 1;
    return;
  }

  const original = await readProjectSources();
  const keptSlugs = keptIconSlugs(PROVIDER_CATALOG, removed);
  let current = original;
  const deleted = new Set();
  const leftovers = [];
  const testMentions = [];

  for (const id of removed) {
    const iconSlug = assertSafeIconSlug(PROVIDER_CATALOG[id].iconSlug);
    const result = pruneProviderSources(current, {
      id,
      iconSlug,
      knownIds: Object.keys(PROVIDER_CATALOG),
      removedIds: removed,
      deleteIcon: !keptSlugs.has(iconSlug),
    });
    current = result.files;
    for (const filePath of result.deleted) deleted.add(filePath);
    leftovers.push(...result.leftovers);
    testMentions.push(...result.testMentions);
  }

  for (const [relative, contents] of Object.entries(current)) {
    if (original[relative] !== contents) {
      await writeFile(path.join(ROOT, relative), contents);
      console.log(`Updated ${relative}`);
    }
  }
  for (const relative of Object.keys(original)) {
    if (!(relative in current)) {
      await rm(path.join(ROOT, relative));
      console.log(`Deleted ${relative}`);
    }
  }
  for (const relative of deleted) {
    if (!relative.endsWith(".svg")) continue;
    await rm(path.join(ROOT, relative), { force: true });
    console.log(`Deleted ${relative}`);
  }

  if (testMentions.length > 0) {
    console.log("Tests still mention a removed provider as one sample among several:");
    for (const mention of testMentions) console.log(`  ${mention}`);
  }
  if (leftovers.length > 0) {
    console.error("Removed providers are still referenced from production code:");
    for (const mention of leftovers) console.error(`  ${mention}`);
    process.exitCode = 1;
  }
}

if (isMainModule(import.meta.url)) {
  prune().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
