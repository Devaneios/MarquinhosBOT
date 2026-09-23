import {
  contractUrl,
  type ContractRequest,
  type ContractRequestParts,
  type ContractResponse,
  type EndpointContract,
} from '@marquinhos/contracts/http/contract';

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, url: string) {
    super(`Request to ${url} failed with ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function fetchContract<C extends EndpointContract>(
  apiBase: string,
  contract: C,
  request: ContractRequest<C>,
  init?: RequestInit,
): Promise<ContractResponse<C>>;
export async function fetchContract(
  apiBase: string,
  contract: EndpointContract,
  request: ContractRequestParts,
  init: RequestInit = {},
): Promise<unknown> {
  const path = contractUrl(contract, request.params, request.query);
  const url = `${apiBase}${path.replace(/^\/api/, '')}`;
  const hasBody = request.body !== undefined;
  const response = await fetch(url, {
    ...init,
    method: contract.method,
    headers: hasBody
      ? { 'Content-Type': 'application/json', ...init.headers }
      : init.headers,
    body: hasBody ? JSON.stringify(request.body) : undefined,
  });
  if (!response.ok) throw new HttpError(response.status, url);
  const parsed = contract.response.safeParse(await response.json());
  if (!parsed.success) throw new Error(`Invalid response from ${url}`);
  return parsed.data;
}
