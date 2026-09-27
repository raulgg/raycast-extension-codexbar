import { describe, expect, it } from "vitest";
import { PROVIDER_CATALOG } from "../catalog";
import zoommate from "./index";

describe("ZoomMate provider module", () => {
  it("is the catalog entry", () => {
    expect(PROVIDER_CATALOG.zoommate).toEqual(zoommate.metadata);
    expect(zoommate.mock).toEqual({ source: "web" });
  });
});
