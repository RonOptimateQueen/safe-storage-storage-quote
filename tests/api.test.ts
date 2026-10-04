import { describe, expect, it, vi } from "vitest";
import { ApiError, createStorageQuoteApi } from "../src/api";

describe("storage quote API", () => {
  it("loads customer prefill through an opaque token", async () => {
    const body = {
      linkStatus: "active",
      customer: { displayName: "לקוח לדוגמה", phone: "0500000000", email: "demo@example.com" },
      owner: { displayName: "נציג" },
    };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    const api = createStorageQuoteApi({ endpointUrl: "https://example.test/hook", fetcher });
    await expect(api.loadPrefill("opaque-token")).resolves.toEqual(body);
    expect(fetcher).toHaveBeenCalledWith("https://example.test/hook?mode=prefill&token=opaque-token", expect.objectContaining({ method: "GET" }));
  });

  it.each(["", "short", "has spaces"])("rejects an invalid token: %s", async (token) => {
    const api = createStorageQuoteApi({ endpointUrl: "https://example.test/hook", fetcher: vi.fn() });
    await expect(api.loadPrefill(token)).rejects.toMatchObject({ code: "INVALID_TOKEN_FORMAT" });
  });

  it("submits JSON with the same idempotency key", async () => {
    const response = { submissionId: "s1", quoteId: "q1", status: "created", lineCount: 2, signatureRequired: false };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    const api = createStorageQuoteApi({ endpointUrl: "https://example.test/hook", fetcher });
    const payload = {
      token: "opaque-token",
      clientSubmissionId: "client-1",
      form: { customerName: "לקוח", quoteDate: "2026-10-04", volumeCubicMeters: 8, pricePerCubicMeter: 100 },
    };
    await expect(api.submitQuote(payload, "client-1")).resolves.toEqual(response);
    expect(fetcher).toHaveBeenCalledWith("https://example.test/hook", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "client-1" },
    }));
  });

  it("rejects success that does not prove all quote lines were created", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ quoteId: "q1", status: "created" }), { status: 200 }));
    const api = createStorageQuoteApi({ endpointUrl: "https://example.test/hook", fetcher });
    await expect(api.submitQuote({ token: "opaque-token", clientSubmissionId: "c1", form: {} as never }, "c1"))
      .rejects.toMatchObject({ code: "INVALID_RESPONSE", retryable: true });
  });

  it("surfaces server errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "LINK_REVOKED", message: "הקישור בוטל" }), { status: 401 }));
    const api = createStorageQuoteApi({ endpointUrl: "https://example.test/hook", fetcher });
    await expect(api.loadPrefill("opaque-token")).rejects.toBeInstanceOf(ApiError);
  });
});
