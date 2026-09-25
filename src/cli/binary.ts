import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { isRecord } from "../usage/json";
import { CodexBarCliError, classifyExecFailure, execFileAsync, executeCodexBar, buildCodexBarProcessEnv } from "./exec";
import { buildInstallHelp, detectHomebrew, findCodexBarApp, type InstallHelpState } from "./install";
import type { KeychainAccessPolicy } from "./keychainAccessPolicy";

const FALLBACK_PATHS = ["/opt/homebrew/bin/codexbar", "/usr/local/bin/codexbar"] as const;

export type ResolvedCodexBarBinary = {
  command: string;
  source: "path" | "fallback" | "mock";
  keychainAccessPolicy: KeychainAccessPolicy;
  capabilities?: CodexBarCapabilities;
};

export type CodexBarCapabilities = {
  appFetchProfile: boolean;
  interactionModes: boolean;
  presentationSchemaVersions: number[];
  serveAppFetchProfile: boolean;
  serveForceRefresh: boolean;
};

export function canForceRefreshViaServe(binary: ResolvedCodexBarBinary): boolean {
  return binary.capabilities?.serveForceRefresh === true;
}

const LEGACY_CAPABILITIES: CodexBarCapabilities = {
  appFetchProfile: false,
  interactionModes: false,
  presentationSchemaVersions: [],
  serveAppFetchProfile: false,
  serveForceRefresh: false,
};

export type { InstallHelpState };

export type CodexBarAvailability =
  | { status: "available"; binary: ResolvedCodexBarBinary }
  | { status: "unavailable"; install: InstallHelpState; error?: Error }
  | { status: "error"; error: Error };

function isExecutablePath(path: string): Promise<boolean> {
  return access(path, constants.X_OK)
    .then(() => true)
    .catch(() => false);
}

async function findInPath(executable: string, pathValue = process.env.PATH ?? ""): Promise<string | undefined> {
  for (const segment of pathValue.split(delimiter).filter(Boolean)) {
    const candidate = join(segment, executable);
    if (await isExecutablePath(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export async function resolveCodexBarBinary(
  keychainAccessPolicy: KeychainAccessPolicy,
): Promise<ResolvedCodexBarBinary> {
  const fromPath = await findInPath("codexbar");
  if (fromPath) {
    return {
      command: fromPath,
      source: "path",
      keychainAccessPolicy,
    };
  }

  for (const fallbackPath of FALLBACK_PATHS) {
    if (await isExecutablePath(fallbackPath)) {
      return {
        command: fallbackPath,
        source: "fallback",
        keychainAccessPolicy,
      };
    }
  }

  throw new CodexBarCliError("unavailable", "Unable to find the `codexbar` CLI on this machine.");
}

function parseCodexBarCapabilities(payload: unknown): CodexBarCapabilities {
  if (!isRecord(payload)) {
    return LEGACY_CAPABILITIES;
  }

  const rawCapabilities = isRecord(payload.capabilities) ? payload.capabilities : payload;
  const fetchProfiles = Array.isArray(rawCapabilities.fetchProfiles) ? rawCapabilities.fetchProfiles : [];
  const interactionModes = Array.isArray(rawCapabilities.interactionModes) ? rawCapabilities.interactionModes : [];
  const presentationSchemaVersions = Array.isArray(rawCapabilities.presentationSchemaVersions)
    ? rawCapabilities.presentationSchemaVersions.filter(
        (version): version is number => typeof version === "number" && Number.isFinite(version),
      )
    : [];
  const serve = isRecord(rawCapabilities.serve) ? rawCapabilities.serve : undefined;

  return {
    appFetchProfile: fetchProfiles.includes("app"),
    interactionModes: interactionModes.includes("background") && interactionModes.includes("user"),
    presentationSchemaVersions,
    serveAppFetchProfile: serve?.fetchProfile === true,
    serveForceRefresh: serve?.forceRefresh === true,
  };
}

function hasNegotiatedCapabilities(capabilities: CodexBarCapabilities): boolean {
  return (
    capabilities.appFetchProfile ||
    capabilities.interactionModes ||
    capabilities.presentationSchemaVersions.length > 0 ||
    capabilities.serveAppFetchProfile ||
    capabilities.serveForceRefresh
  );
}

async function detectCodexBarCapabilities(binary: ResolvedCodexBarBinary): Promise<CodexBarCapabilities | undefined> {
  try {
    const payload = await executeCodexBar(binary, ["capabilities", "--format", "json", "--json-only"]);
    const capabilities = parseCodexBarCapabilities(payload);
    return hasNegotiatedCapabilities(capabilities) ? capabilities : undefined;
  } catch {
    return undefined;
  }
}

export async function smokeTestCodexBar(binary: ResolvedCodexBarBinary): Promise<void> {
  try {
    await execFileAsync(binary.command, ["--version"], {
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 64 * 1024,
      env: buildCodexBarProcessEnv(binary.keychainAccessPolicy),
    });
  } catch (error) {
    throw classifyExecFailure(error);
  }
}

export async function getCodexBarAvailability(
  keychainAccessPolicy: KeychainAccessPolicy,
): Promise<CodexBarAvailability> {
  try {
    const binary = await resolveCodexBarBinary(keychainAccessPolicy);
    await smokeTestCodexBar(binary);
    const capabilities = await detectCodexBarCapabilities(binary);

    return {
      status: "available",
      binary: capabilities ? { ...binary, capabilities } : binary,
    };
  } catch (error) {
    if (error instanceof CodexBarCliError && error.kind === "unavailable") {
      // The app is looked for only here, and only to pick which help view
      // renders: app presence never gates usage, so standalone CLI installs
      // (Homebrew formula, release tarball) stay first-class.
      const [helperPath, homebrewPrefix] = await Promise.all([findCodexBarApp(), detectHomebrew()]);
      return {
        status: "unavailable",
        install: buildInstallHelp({ helperPath, homebrewPrefix }),
        error,
      };
    }

    return {
      status: "error",
      error: error instanceof Error ? error : new Error("Unknown CodexBar availability error"),
    };
  }
}
