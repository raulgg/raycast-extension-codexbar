import { Cache } from "@raycast/api";
import { beforeEach, describe, expect, it } from "vitest";
import { createIndexedCache } from "./indexedCache";

const NAMESPACE = "indexed-cache-test";

function raw(): Cache {
  return new Cache({ namespace: NAMESPACE });
}

function create() {
  return createIndexedCache({ namespace: NAMESPACE, schemaVersion: "v2", legacySchemaVersions: ["v1"] });
}

describe("createIndexedCache", () => {
  beforeEach(() => {
    raw().clear();
  });

  it("keys entries by schema, policy, and provider and tracks provider ids in an index", () => {
    const cache = create();
    cache.set("codex", "default", "a");
    cache.set("claude", "disabled", "b");

    expect(raw().get("v2:default:codex")).toBe("a");
    expect(raw().get("v2:disabled:claude")).toBe("b");
    expect(JSON.parse(raw().get("v2:index") ?? "[]")).toEqual(["codex", "claude"]);
    expect(cache.get("codex", "default")).toBe("a");
    expect(cache.get("codex", "disabled")).toBeUndefined();
  });

  it("drops a provider from the index only once every policy scope is empty", () => {
    const cache = create();
    cache.set("codex", "default", "a");
    cache.set("codex", "disabled", "b");

    cache.remove("codex", "default");
    expect(JSON.parse(raw().get("v2:index") ?? "[]")).toEqual(["codex"]);

    cache.remove("codex", "disabled");
    expect(raw().get("v2:index")).toBeUndefined();
  });

  it("prunes with the caller's decision, sweeps legacy keys, and visits extra provider ids", () => {
    const cache = create();
    cache.set("codex", "default", "keep");
    cache.set("claude", "default", "drop");
    cache.set("cursor", "disabled", "rewrite");
    raw().set("v1:codex", "legacy");
    raw().set("v2:default:gemini", "untracked");

    cache.prune(["gemini"], (serialized) => {
      if (serialized === "drop") return undefined;
      if (serialized === "rewrite") return "rewritten";
      return serialized;
    });

    expect(raw().get("v1:codex")).toBeUndefined();
    expect(raw().get("v2:default:codex")).toBe("keep");
    expect(raw().get("v2:default:claude")).toBeUndefined();
    expect(raw().get("v2:disabled:cursor")).toBe("rewritten");
    expect(raw().get("v2:default:gemini")).toBe("untracked");
    // Extra ids are visited for sweeping but never adopted into the index.
    expect(JSON.parse(raw().get("v2:index") ?? "[]").sort()).toEqual(["codex", "cursor"]);
  });

  it("recovers from a corrupt index", () => {
    const cache = create();
    raw().set("v2:index", "{not json");

    expect(cache.get("codex", "default")).toBeUndefined();
    cache.set("codex", "default", "a");
    expect(JSON.parse(raw().get("v2:index") ?? "[]")).toEqual(["codex"]);
  });
});
