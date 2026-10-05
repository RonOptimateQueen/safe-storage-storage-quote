import { describe, expect, it, vi } from "vitest";
import { ApiError, createStorageQuoteApi } from "../src/api";

describe("storage quote API", () => {
  it("loads a read-only quote document through an opaque token", async () => {
    const body = {
      linkStatus: "active",
      quote: { displayName: "הצעת מחיר", quoteNumber: "42", createdOn: "2026-10-04T10:00:00Z", total: 800 },
      customer: { displayName: "לקוח לדוגמה", phone: "0500000000", email: "demo@example.com" },
      owner: { displayName: "נציג" },
      lines: [{ description: "אחסנה חודשית", quantity: 8, unitPrice: 100, amount: 800 }],
    };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    const api = createStorageQuoteApi({ endpointUrl: "https://example.test/hook", fetcher });
    await expect(api.loadDocument("opaque-token")).resolves.toEqual(body);
    expect(fetcher).toHaveBeenCalledWith("https://example.test/hook?mode=document&token=opaque-token", expect.objectContaining({ method: "GET" }));
  });

  it.each(["", "short", "has spaces"])("rejects an invalid token: %s", async (token) => {
    const api = createStorageQuoteApi({ endpointUrl: "https://example.test/hook", fetcher: vi.fn() });
    await expect(api.loadDocument(token)).rejects.toMatchObject({ code: "INVALID_TOKEN_FORMAT" });
  });

  it("rejects a response without quote lines", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ quoteId: "q1", status: "created" }), { status: 200 }));
    const api = createStorageQuoteApi({ endpointUrl: "https://example.test/hook", fetcher });
    await expect(api.loadDocument("opaque-token"))
      .rejects.toMatchObject({ code: "INVALID_RESPONSE", retryable: true });
  });

  it("surfaces server errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "LINK_REVOKED", message: "הקישור בוטל" }), { status: 401 }));
    const api = createStorageQuoteApi({ endpointUrl: "https://example.test/hook", fetcher });
    await expect(api.loadDocument("opaque-token")).rejects.toBeInstanceOf(ApiError);
  });
});
