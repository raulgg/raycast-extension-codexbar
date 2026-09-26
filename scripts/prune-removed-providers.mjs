#!/usr/bin/env node

// Deletes the table rows for providers the pinned CodexBar revision no longer ships.
// Call sites and tests stay. Any remaining mention exits non-zero so a bump cannot
// move the lockfile until those references are gone.
//
//   npm run upstream:prune
//   npm run upstream:prune -- --check

import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PROVIDER_CATALOG } from "../src/providers/catalog.ts";
import { collectProviderMentions, keptIconSlugs, pruneProviderSources } from "./lib/prune-provider.mjs";
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

  const original = await readProjectSources();
  const keptSlugs = keptIconSlugs(PROVIDER_CATALOG, removed);
  let current = original;
  const deleted = new Set();
  const mentions = [];

  for (const id of removed) {
    const iconSlug = assertSafeIconSlug(PROVIDER_CATALOG[id].iconSlug);
    const result = pruneProviderSources(current, {
      id,
      iconSlug,
      keptIconSlugs: keptSlugs,
      deleteIcon: !keptSlugs.has(iconSlug),
      scan: false,
    });
    current = result.files;
    for (const filePath of result.deleted) deleted.add(filePath);
    mentions.push(...result.mentions.map((mention) => `${id} ${mention}`));
  }
  for (const id of removed) {
    mentions.push(...collectProviderMentions(current, id, keptSlugs).map((mention) => `${id} ${mention}`));
  }

  if (mentions.length > 0) {
    console.error("These references still use a removed provider, so nothing was written:");
    for (const mention of mentions) console.error(`  ${mention}`);
    process.exitCode = 1;
    return;
  }

  if (CHECK_ONLY) {
    process.exitCode = 1;
    return;
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
}

if (isMainModule(import.meta.url)) {
  prune().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
