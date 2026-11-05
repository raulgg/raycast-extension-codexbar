#!/usr/bin/env node

// Writes src/providers/meterDetail.ts from the upstream menu card descriptors.
//
// Usage:
//   npm run upstream:sync-meter-detail                      # descriptors at codexbar-upstream.lock
//   CODEXBAR_REF=<sha> npm run upstream:sync-meter-detail   # descriptors at another ref
//   CODEXBAR_DIR=~/code/CodexBar npm run ...                # a clean local checkout
//
// It writes nothing when a descriptor fails to parse. Run upstream:check afterwards: it still owns
// UNPORTABLE_MENU_CARD and the menuCardReviewed pin.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  METER_DETAIL_PATH,
  meterDetailEntries,
  parseMenuCardPresentation,
  renderMeterDetail,
} from "./lib/meter-detail.mjs";
import { createUpstreamSource, isMainModule, readFilesWithConcurrency } from "./lib/upstream.mjs";
import { parseDescriptorMetadata } from "./lib/upstream-metadata.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESCRIPTOR_DIR = "Sources/CodexBarCore/Providers";

export async function readMenuCardPresentations(source) {
  const descriptorPaths = (await source.listFiles(DESCRIPTOR_DIR, "ProviderDescriptor.swift")).filter(
    (filePath) => !filePath.endsWith("/ProviderDescriptor.swift"),
  );
  if (descriptorPaths.length === 0) {
    throw new Error(`No provider descriptors found under ${DESCRIPTOR_DIR} in ${source.label}.`);
  }
  const presentations = new Map();
  const problems = [];
  for (const { path: filePath, content } of await readFilesWithConcurrency(source, descriptorPaths)) {
    const { id } = parseDescriptorMetadata(content, filePath);
    const parsed = parseMenuCardPresentation(content, filePath);
    if (parsed.ok) presentations.set(id, parsed.presentation);
    else problems.push(parsed.error);
  }
  return { presentations, problems };
}

// Returns { written, problems }. written is false when the file already matched or a parse failed.
export async function syncMeterDetail(source, root = ROOT) {
  const { presentations, problems } = await readMenuCardPresentations(source);
  if (problems.length > 0) return { written: false, problems };
  const target = path.join(root, METER_DETAIL_PATH);
  const next = renderMeterDetail(meterDetailEntries(presentations));
  let current;
  try {
    current = await readFile(target, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (current === next) return { written: false, problems: [] };
  await writeFile(target, next, "utf8");
  return { written: true, problems: [] };
}

async function main() {
  const source = await createUpstreamSource();
  const result = await syncMeterDetail(source);
  if (result.problems.length > 0) {
    console.error(`Menu card descriptors in ${source.label} did not parse. ${METER_DETAIL_PATH} not written:\n`);
    for (const problem of result.problems) {
      console.error(`  - ${problem}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(
    result.written
      ? `Wrote ${METER_DETAIL_PATH} from ${source.label}. Run npm run upstream:check next.`
      : `${METER_DETAIL_PATH} already matches ${source.label}.`,
  );
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
