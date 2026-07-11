import { describe, expect, it } from "vitest";

import { buildBearerHeaders } from "./authHeaders";

describe("buildBearerHeaders", () => {
  it("adds the signed guest bearer token", () => {
    expect(buildBearerHeaders("neloo-anon-v1.payload.signature")).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer neloo-anon-v1.payload.signature",
    });
  });

  it("does not create a fake authorization header", () => {
    expect(buildBearerHeaders("")).toEqual({
      "Content-Type": "application/json",
    });
    expect(buildBearerHeaders(undefined)).toEqual({
      "Content-Type": "application/json",
    });
  });
});
