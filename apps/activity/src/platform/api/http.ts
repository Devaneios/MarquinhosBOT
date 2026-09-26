import { ServerError } from '@colyseus/sdk';
import { HttpError } from '@marquinhos/api-client/browser';

export function isAuthError(err: unknown): boolean {
  if (err instanceof HttpError) return err.status === 401 || err.status === 403;
  return err instanceof ServerError;
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
