export interface StorageQuoteRuntimeConfig {
  endpointUrl: string;
  tokenQueryKey: string;
}

export type StorageQuoteRuntimeConfigSource = Partial<Record<keyof StorageQuoteRuntimeConfig, string>>;

export function readRuntimeConfig(source: StorageQuoteRuntimeConfigSource): StorageQuoteRuntimeConfig {
  const endpointUrl = String(source.endpointUrl ?? "").trim();
  if (!endpointUrl) throw new Error("חסרה כתובת החיבור לטופס");
  const parsed = new URL(endpointUrl);
  if (parsed.protocol !== "https:") throw new Error("כתובת החיבור חייבת להיות מאובטחת");
  const tokenQueryKey = String(source.tokenQueryKey ?? "token").trim();
  if (!tokenQueryKey) throw new Error("חסר שם פרמטר הקישור");
  return { endpointUrl: parsed.toString(), tokenQueryKey };
}
