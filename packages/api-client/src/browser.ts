import { z } from 'zod';

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, url: string) {
    super(`Request to ${url} failed with ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export async function postJson(url: string, body: unknown): Promise<unknown>;
export async function postJson<T>(
  url: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T>;
export async function postJson(
  url: string,
  body: unknown,
  schema: z.ZodType = z.unknown().optional(),
): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new HttpError(res.status, url);
  }
  const parsed = z.object({ data: schema }).safeParse(await res.json());
  if (!parsed.success) {
    throw new Error(`Invalid response from ${url}`);
  }
  return parsed.data.data;
}

export async function requestJson(url: string, options: RequestInit): Promise<unknown> {
  const response = await fetch(url, options);
  if (!response.ok) throw new HttpError(response.status, url);
  return response.json();
}
