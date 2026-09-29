// Shared access to the upstream CodexBar repository for the upstream:* scripts.
// Default ref is the SHA in codexbar-upstream.lock. Override with CODEXBAR_REF, or
// CODEXBAR_DIR for a local checkout. Resolution failures throw.

import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const UPSTREAM_REPO = "steipete/CodexBar";

const LOCK_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../codexbar-upstream.lock");

export function upstreamLockPath() {
  return LOCK_PATH;
}

export function readUpstreamLock(lockSource) {
  let lock;
  try {
    lock = JSON.parse(lockSource);
  } catch {
    throw new Error("codexbar-upstream.lock is not valid JSON.");
  }

  if (!lock || typeof lock !== "object" || Array.isArray(lock)) {
    throw new Error("codexbar-upstream.lock must be a JSON object.");
  }

  if (lock.repo !== UPSTREAM_REPO) {
    throw new Error(`codexbar-upstream.lock repo must be "${UPSTREAM_REPO}".`);
  }

  if (typeof lock.tag !== "string" || lock.tag.trim() === "") {
    throw new Error("codexbar-upstream.lock is missing tag.");
  }

  if (typeof lock.sha !== "string" || !/^[0-9a-f]{40}$/i.test(lock.sha)) {
    throw new Error("codexbar-upstream.lock sha must be a 40-character hex commit.");
  }

  return { repo: UPSTREAM_REPO, tag: lock.tag, sha: lock.sha.toLowerCase() };
}

export function readMenuCardReviewed(lockSource) {
  let lock;
  try {
    lock = JSON.parse(lockSource);
  } catch {
    throw new Error("codexbar-upstream.lock is not valid JSON.");
  }

  const reviewed = lock?.menuCardReviewed;
  if (!reviewed || typeof reviewed !== "object" || Array.isArray(reviewed)) {
    throw new Error("codexbar-upstream.lock is missing menuCardReviewed.");
  }

  if (typeof reviewed.sha !== "string" || !/^[0-9a-f]{40}$/i.test(reviewed.sha)) {
    throw new Error("codexbar-upstream.lock menuCardReviewed.sha must be a 40-character hex commit.");
  }

  if (!Array.isArray(reviewed.paths) || reviewed.paths.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    throw new Error("codexbar-upstream.lock menuCardReviewed.paths must be a list of paths.");
  }

  return { sha: reviewed.sha.toLowerCase(), paths: reviewed.paths };
}

// Written into codexbar-upstream.lock. JSON has no line comments, and readUpstreamLock ignores this.
export const UPSTREAM_LOCK_NOTE = "Written by npm run upstream:bump. Don't hand-edit.";

export function renderUpstreamLock(target) {
  const lock = {
    note: UPSTREAM_LOCK_NOTE,
    repo: target.repo,
    tag: target.tag,
    sha: target.sha.toLowerCase(),
  };
  if (target.menuCardReviewed) {
    lock.menuCardReviewed = {
      sha: target.menuCardReviewed.sha.toLowerCase(),
      paths: target.menuCardReviewed.paths,
    };
  }
  return `${JSON.stringify(lock, null, 2)}\n`;
}

export function assertSafeUpstreamRef(ref) {
  if (typeof ref !== "string" || ref.trim() === "") {
    throw new Error("Upstream ref is empty.");
  }

  if (ref.includes("..") || ref.includes("?") || ref.includes("#") || ref.includes("://") || ref.includes("\\")) {
    throw new Error(`Unsafe upstream ref "${ref}".`);
  }

  return ref;
}

export function encodeRefForUrl(ref) {
  return assertSafeUpstreamRef(ref)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function isMainModule(moduleUrl, argv1 = process.argv[1]) {
  return Boolean(argv1 && pathToFileURL(path.resolve(argv1)).href === moduleUrl);
}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN;
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function resolveCommitSha(ref) {
  if (/^[0-9a-f]{40}$/i.test(ref)) return ref.toLowerCase();
  const commit = JSON.parse(
    await fetchText(`https://api.github.com/repos/${UPSTREAM_REPO}/commits/${encodeRefForUrl(ref)}`, githubHeaders()),
  );
  if (typeof commit.sha !== "string" || !/^[0-9a-f]{40}$/i.test(commit.sha)) {
    throw new Error(`Could not resolve commit SHA for ${UPSTREAM_REPO} ${ref}.`);
  }
  return commit.sha.toLowerCase();
}

async function listGithubChangedPaths(from, to) {
  if (from.toLowerCase() === to.toLowerCase()) return [];
  const compare = JSON.parse(
    await fetchText(
      `https://api.github.com/repos/${UPSTREAM_REPO}/compare/${encodeRefForUrl(from)}...${encodeRefForUrl(to)}`,
      githubHeaders(),
    ),
  );
  // The compare response caps files at 300 and then omits the rest.
  if (!Array.isArray(compare.files) || compare.files.length >= 300) {
    throw new Error(`GitHub compare ${from}...${to} did not return a complete file list.`);
  }
  return compare.files.map((file) => file.filename).filter((filename) => typeof filename === "string");
}

async function fetchText(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const rateLimitHint =
      response.status === 403 && url.startsWith("https://api.github.com/")
        ? " (likely the unauthenticated rate limit; set GITHUB_TOKEN, or CODEXBAR_DIR for a local checkout)"
        : "";
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}${rateLimitHint}`);
  }
  return response.text();
}

export async function resolveUpstreamTarget() {
  if (process.env.CODEXBAR_REF) {
    const ref = assertSafeUpstreamRef(process.env.CODEXBAR_REF);
    return { ref, label: `CodexBar ref "${ref}"` };
  }

  let lockSource;
  try {
    lockSource = await readFile(LOCK_PATH, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Missing ${LOCK_PATH}. Run npm run upstream:bump to create it.`);
    }
    throw error;
  }

  const lock = readUpstreamLock(lockSource);
  return { ref: lock.sha, label: `CodexBar ${lock.tag} (${lock.sha.slice(0, 12)})` };
}

export async function fetchLatestReleaseTarget() {
  const release = JSON.parse(
    await fetchText(`https://api.github.com/repos/${UPSTREAM_REPO}/releases/latest`, githubHeaders()),
  );
  if (!release.tag_name) {
    throw new Error(`Could not resolve the latest ${UPSTREAM_REPO} release tag.`);
  }

  const tag = assertSafeUpstreamRef(release.tag_name);
  const commit = JSON.parse(
    await fetchText(`https://api.github.com/repos/${UPSTREAM_REPO}/commits/${encodeRefForUrl(tag)}`, githubHeaders()),
  );
  if (typeof commit.sha !== "string" || !/^[0-9a-f]{40}$/i.test(commit.sha)) {
    throw new Error(`Could not resolve commit SHA for ${UPSTREAM_REPO} ${tag}.`);
  }

  return { repo: UPSTREAM_REPO, tag, sha: commit.sha.toLowerCase() };
}

async function listLocalFiles(dir, suffix) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listLocalFiles(entryPath, suffix)));
    } else if (entry.name.endsWith(suffix)) {
      files.push(entryPath);
    }
  }
  return files;
}

function gitText(localDir, args) {
  return execFileSync("git", ["-C", localDir, ...args], { encoding: "utf8" });
}

export async function createUpstreamSource() {
  const localDir = process.env.CODEXBAR_DIR;
  if (localDir) {
    const sha = gitText(localDir, ["rev-parse", "HEAD"]).trim().toLowerCase();
    return {
      label: `local checkout ${localDir}`,
      sha,
      listChangedPaths: async (from, to) => {
        if (from.toLowerCase() === to.toLowerCase()) return [];
        return gitText(localDir, ["diff", "--name-only", from, to])
          .split("\n")
          .filter((line) => line.length > 0);
      },
      listFiles: async (prefix, suffix) => {
        const files = await listLocalFiles(path.join(localDir, prefix), suffix);
        return files.map((file) => path.relative(localDir, file));
      },
      readFile: (repoPath) => readFile(path.join(localDir, repoPath), "utf8"),
    };
  }

  const target = await resolveUpstreamTarget();
  const sha = await resolveCommitSha(target.ref);
  const encodedRef = encodeRefForUrl(target.ref);
  const rawUrl = (repoPath) => `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${encodedRef}/${repoPath}`;
  return {
    label: target.label,
    ref: target.ref,
    sha,
    listChangedPaths: (from, to) => listGithubChangedPaths(from, to),
    listFiles: async (prefix, suffix) => {
      const tree = JSON.parse(
        await fetchText(
          `https://api.github.com/repos/${UPSTREAM_REPO}/git/trees/${encodedRef}?recursive=1`,
          githubHeaders(),
        ),
      );
      if (tree.truncated) {
        throw new Error(`GitHub tree listing for ref "${target.ref}" was truncated; cannot enumerate ${prefix}.`);
      }
      return tree.tree
        .filter((entry) => entry.path.startsWith(prefix) && entry.path.endsWith(suffix))
        .map((entry) => entry.path);
    },
    readFile: (repoPath) => fetchText(rawUrl(repoPath)),
  };
}

export async function readFilesWithConcurrency(source, repoPaths, concurrency = 6) {
  const contents = [];
  for (let index = 0; index < repoPaths.length; index += concurrency) {
    const batch = repoPaths.slice(index, index + concurrency);
    contents.push(...(await Promise.all(batch.map((repoPath) => source.readFile(repoPath)))));
  }
  return repoPaths.map((repoPath, index) => ({ path: repoPath, content: contents[index] }));
}
