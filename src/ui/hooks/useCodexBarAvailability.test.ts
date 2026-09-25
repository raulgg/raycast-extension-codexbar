import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedCodexBarBinary } from "../../cli/binary";

const binary: ResolvedCodexBarBinary = {
  command: "/usr/local/bin/codexbar",
  source: "path",
  keychainAccessPolicy: "default",
};

const restoredSnapshot = JSON.parse(
  JSON.stringify({
    status: "available",
    mode: "cli",
    binary,
  }),
);

const { useCachedPromiseMock, cacheSlot } = vi.hoisted(() => ({
  useCachedPromiseMock: vi.fn(),
  cacheSlot: {
    data: undefined as unknown,
  },
}));

vi.mock("@raycast/utils", () => ({
  useCachedPromise: (...args: unknown[]) => useCachedPromiseMock(...args),
}));

vi.mock("react", () => ({
  useMemo: (factory: () => unknown) => factory(),
}));

import { loadCodexBarAvailabilitySnapshot } from "../../services/codexbarClient";
import { useCodexBarAvailability } from "./useCodexBarAvailability";

describe("useCodexBarAvailability", () => {
  beforeEach(() => {
    useCachedPromiseMock.mockReset();
    cacheSlot.data = restoredSnapshot;
    useCachedPromiseMock.mockImplementation(() => ({
      data: cacheSlot.data,
      isLoading: false,
      error: undefined,
      revalidate: vi.fn(),
    }));
  });

  it("rebuilds a client from the snapshot Raycast restored", () => {
    const result = useCodexBarAvailability();

    expect(useCachedPromiseMock).toHaveBeenCalledWith(loadCodexBarAvailabilitySnapshot, ["default"], {
      keepPreviousData: false,
    });
    expect(result.availability?.status).toBe("available");
    if (result.availability?.status !== "available") return;

    expect(typeof result.availability.client.readConfiguredProviders).toBe("function");
    expect(typeof result.availability.client.listAvailableProviders).toBe("function");
    expect(typeof result.availability.client.fetchUsage).toBe("function");
    expect(result.availability.client.binary).toEqual(binary);
  });

  it("turns a restored client that lost its methods into a retryable CLI check error", () => {
    cacheSlot.data = {
      status: "available",
      client: { binary },
    };

    const result = useCodexBarAvailability();

    expect(result.availability?.status).toBe("error");
    if (result.availability?.status === "error") {
      expect(result.availability.error).toBeInstanceOf(Error);
      expect(result.availability.error.message.length).toBeGreaterThan(0);
    }
  });
});
