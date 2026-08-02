export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, url: string) {
    super(`Request to ${url} failed with ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function isAuthError(err: unknown): boolean {
  return err instanceof HttpError && (err.status === 401 || err.status === 403);
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new HttpError(res.status, url);
  }
  const { data } = await res.json();
  return data;
}

// Discord's embedded-app-sdk rejects RPC command failures (e.g. authorize,
// authenticate) with a raw `{ code, message }` payload instead of an Error
// instance, so `err instanceof Error` misses them and swallows the real
// message.
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof err.message === 'string'
  ) {
    return err.message;
  }
  return 'Unknown error';
}
