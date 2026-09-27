import { describe, expect, it } from "vitest";
import { getMockProviderPayload } from "./mockPayloads";

describe("getMockProviderPayload", () => {
  it("reads ZoomMate's mock source from the provider module", () => {
    expect(getMockProviderPayload("zoommate", new Date("2026-09-26T00:00:00Z")).source).toBe("web");
  });
});
