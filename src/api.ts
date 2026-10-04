import type { StorageQuoteInput } from "./model";

export interface StorageQuotePrefill {
  linkStatus: "active";
  customer: {
    displayName: string;
    phone: string | null;
    email: string | null;
  };
  owner: { displayName: string | null };
}

export interface StorageQuoteSubmitResponse {
  submissionId: string;
  quoteId: string;
  status: "created";
  lineCount: number;
  signatureRequired: false;
}

export interface StorageQuoteRequest {
  token: string;
  clientSubmissionId: string;
  form: StorageQuoteInput;
}

type Fetcher = typeof fetch;

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
    public retryable = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,512}$/;

async function requestJson<T>(fetcher: Fetcher, url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError("INVALID_RESPONSE", "השרת החזיר תשובה לא תקינה", response.status, response.status >= 500);
    }
    if (!response.ok) {
      const error = body as { code?: string; message?: string };
      throw new ApiError(error.code ?? "REQUEST_FAILED", error.message ?? "הפעולה נכשלה", response.status, response.status >= 500);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("NETWORK_ERROR", "לא ניתן להתחבר. בדקו את החיבור ונסו שוב.", 0, true);
  } finally {
    clearTimeout(timer);
  }
}

function isPrefill(value: unknown): value is StorageQuotePrefill {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  if (result.linkStatus !== "active" || typeof result.customer !== "object" || result.customer === null) return false;
  const customer = result.customer as Record<string, unknown>;
  const nullableString = (item: unknown) => item === null || typeof item === "string";
  return typeof customer.displayName === "string" && nullableString(customer.phone) && nullableString(customer.email);
}

function isSubmitResponse(value: unknown): value is StorageQuoteSubmitResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return typeof result.submissionId === "string" && result.submissionId.length > 0
    && typeof result.quoteId === "string" && result.quoteId.length > 0
    && result.status === "created"
    && typeof result.lineCount === "number" && Number.isInteger(result.lineCount) && result.lineCount >= 1
    && result.signatureRequired === false;
}

export function createStorageQuoteApi(options: { endpointUrl: string; fetcher?: Fetcher; timeoutMs?: number }) {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;
  return {
    async loadPrefill(token: string): Promise<StorageQuotePrefill> {
      if (!TOKEN_PATTERN.test(token)) throw new ApiError("INVALID_TOKEN_FORMAT", "הקישור אינו תקין", 400);
      const url = new URL(options.endpointUrl);
      url.searchParams.set("mode", "prefill");
      url.searchParams.set("token", token);
      const response = await requestJson<unknown>(fetcher, url.toString(), { method: "GET" }, timeoutMs);
      if (!isPrefill(response)) throw new ApiError("INVALID_RESPONSE", "נתוני הלקוח שהתקבלו אינם תקינים", 200, true);
      return response;
    },

    async submitQuote(payload: StorageQuoteRequest, idempotencyKey: string): Promise<StorageQuoteSubmitResponse> {
      const response = await requestJson<unknown>(fetcher, options.endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      }, timeoutMs);
      if (!isSubmitResponse(response)) throw new ApiError("INVALID_RESPONSE", "השרת לא אישר שההצעה נוצרה במלואה", 200, true);
      return response;
    },
  };
}
