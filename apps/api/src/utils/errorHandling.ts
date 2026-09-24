import { DrizzleQueryError } from 'drizzle-orm/errors';

export function getErrorMessage(error: unknown): string {
  // Drizzle puts every bound parameter (user content, tokens) into the
  // message; keep the statement and the driver's reason only.
  if (error instanceof DrizzleQueryError) {
    return `Failed query: ${error.query} (${getErrorMessage(error.cause)})`;
  }
  return error instanceof Error ? error.message : String(error);
}
