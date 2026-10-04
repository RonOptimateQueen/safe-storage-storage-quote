const SESSION_KEY_PREFIX = "storageQuoteSubmission:";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sessionKey(token: string): string {
  return `${SESSION_KEY_PREFIX}${encodeURIComponent(token)}`;
}

export function currentSubmissionId(token: string, storage: Storage = sessionStorage): string {
  const key = sessionKey(token);
  const existing = storage.getItem(key);
  if (existing && UUID_PATTERN.test(existing)) return existing;
  const created = crypto.randomUUID();
  storage.setItem(key, created);
  return created;
}

export function resetSubmissionId(token: string, storage: Storage = sessionStorage): void {
  storage.removeItem(sessionKey(token));
}
