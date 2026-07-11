import { describe, expect, it } from "vitest";

import { redactToolArgs } from "./redactToolArgs";

describe("redactToolArgs", () => {
  it("recursively redacts credential-like fields", () => {
    expect(
      redactToolArgs({
        app_name: "gmail",
        params: {
          authorization: "Bearer private",
          nested: [{ api_key: "secret" }, { subject: "Hello" }],
        },
      }),
    ).toEqual({
      app_name: "gmail",
      params: {
        authorization: "••••••",
        nested: [{ api_key: "••••••" }, { subject: "Hello" }],
      },
    });
  });

  it("does not mutate the original arguments", () => {
    const original = { password: "private" };
    redactToolArgs(original);
    expect(original.password).toBe("private");
  });
});
