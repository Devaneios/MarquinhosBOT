import { z } from 'zod';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface EndpointContract {
  method: HttpMethod;
  path: `/api/${string}`;
  params?: z.ZodType<Record<string, string>>;
  query?: z.ZodType;
  body?: z.ZodType;
  response: z.ZodType;
}

export function defineContract<const C extends EndpointContract>(
  contract: C,
): C {
  return contract;
}

type RequestPart<C, K extends 'params' | 'query' | 'body'> = C extends {
  [P in K]: infer S extends z.ZodType;
}
  ? object extends z.input<S>
    ? { [P in K]?: z.input<S> }
    : { [P in K]: z.input<S> }
  : unknown;

export interface ContractRequestParts {
  params?: Record<string, string>;
  query?: object;
  body?: unknown;
}

export type ContractRequest<C extends EndpointContract> = ContractRequestParts &
  RequestPart<C, 'params'> &
  RequestPart<C, 'query'> &
  RequestPart<C, 'body'>;

export type ContractParsedRequest<C extends EndpointContract> = {
  [
    K in 'params' | 'query' | 'body' as C extends { [P in K]: z.ZodType }
      ? K
      : never
  ]: C extends { [P in K]: infer S extends z.ZodType } ? z.output<S> : never;
};

export type ContractResponse<C extends EndpointContract> = z.output<
  C['response']
>;

export type ContractResponseInput<C extends EndpointContract> = z.input<
  C['response']
>;

export function envelope<T extends z.ZodType>(data: T) {
  return z.object({ data, message: z.string().optional() });
}

export const isoDate = z.union([z.date(), z.string()]).pipe(z.coerce.date());

export const errorBodySchema = z.object({ message: z.string() });

export function contractUrl(
  contract: EndpointContract,
  params: Record<string, string> | undefined,
  query: object | undefined,
): string {
  const path = contract.path.replace(/:(\w+)/g, (_, name: string) => {
    const value = params?.[name];
    if (value === undefined) {
      throw new Error(`Missing path param "${name}" for ${contract.path}`);
    }
    return encodeURIComponent(value);
  });
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}
