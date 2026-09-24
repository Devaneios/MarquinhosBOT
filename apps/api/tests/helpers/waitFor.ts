const DEFAULT_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 10;

/**
 * Polls until `read` returns `expected`, for effects that sessions trigger
 * without waiting (e.g. match results written in the background). Returns the
 * last value read so the caller's assertion reports it on timeout.
 */
export async function waitFor<T>(
  read: () => Promise<T>,
  expected: T,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (value !== expected && Date.now() < deadline) {
    await Bun.sleep(POLL_INTERVAL_MS);
    value = await read();
  }
  return value;
}
