export interface StorageQuoteLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface StorageQuoteDocument {
  linkStatus: "active";
  quote: {
    displayName: string;
    quoteNumber: string | null;
    createdOn: string;
    total: number;
  };
  customer: {
    displayName: string;
    phone: string | null;
    email: string | null;
  };
  owner: { displayName: string | null };
  lines: StorageQuoteLine[];
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
      throw new ApiError(error.code ?? "REQUEST_FAILED", error.message ?? "טעינת ההצעה נכשלה", response.status, response.status >= 500);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("NETWORK_ERROR", "לא ניתן להתחבר. בדקו את החיבור ונסו שוב.", 0, true);
  } finally {
    clearTimeout(timer);
  }
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isDocument(value: unknown): value is StorageQuoteDocument {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  if (result.linkStatus !== "active" || !Array.isArray(result.lines)) return false;
  if (typeof result.quote !== "object" || result.quote === null || typeof result.customer !== "object" || result.customer === null) return false;
  const quote = result.quote as Record<string, unknown>;
  const customer = result.customer as Record<string, unknown>;
  return typeof quote.displayName === "string"
    && isNullableString(quote.quoteNumber)
    && typeof quote.createdOn === "string"
    && isFiniteNumber(quote.total)
    && typeof customer.displayName === "string"
    && isNullableString(customer.phone)
    && isNullableString(customer.email)
    && result.lines.length >= 1
    && result.lines.every((line) => {
      if (typeof line !== "object" || line === null || Array.isArray(line)) return false;
      const item = line as Record<string, unknown>;
      return typeof item.description === "string"
        && isFiniteNumber(item.quantity)
        && isFiniteNumber(item.unitPrice)
        && isFiniteNumber(item.amount);
    });
}

export function createStorageQuoteApi(options: { endpointUrl: string; fetcher?: Fetcher; timeoutMs?: number }) {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;
  return {
    async loadDocument(token: string): Promise<StorageQuoteDocument> {
      if (!TOKEN_PATTERN.test(token)) throw new ApiError("INVALID_TOKEN_FORMAT", "הקישור להצעה אינו תקין", 400);
      const url = new URL(options.endpointUrl);
      url.searchParams.set("mode", "document");
      url.searchParams.set("token", token);
      const response = await requestJson<unknown>(fetcher, url.toString(), { method: "GET" }, timeoutMs);
      if (!isDocument(response)) throw new ApiError("INVALID_RESPONSE", "נתוני ההצעה שהתקבלו אינם תקינים", 200, true);
      return response;
    },
  };
}
