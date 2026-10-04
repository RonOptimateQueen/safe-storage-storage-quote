import { describe, expect, it } from "vitest";
import { readRuntimeConfig } from "../src/config";

describe("runtime config", () => {
  it("accepts an HTTPS endpoint and defaults the token key", () => {
    expect(readRuntimeConfig({ endpointUrl: "https://example.test/hook" })).toEqual({
      endpointUrl: "https://example.test/hook",
      tokenQueryKey: "token",
    });
  });

  it("rejects missing and insecure endpoints", () => {
    expect(() => readRuntimeConfig({})).toThrow();
    expect(() => readRuntimeConfig({ endpointUrl: "http://example.test/hook" })).toThrow();
  });
});
