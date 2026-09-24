import {
  contractUrl,
  type ContractRequest,
  type ContractRequestParts,
  type ContractResponse,
  type EndpointContract,
} from '@marquinhos/contracts/http/contract';

export interface HttpClientOptions {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  onRetry?: (message: string) => void;
}

export interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  url?: string;
}

export class HttpError extends Error {
  public response?: { status?: number; data?: unknown };
  public config?: { url?: string };

  constructor(
    message: string,
    options?: {
      response?: { status?: number; data?: unknown };
      config?: { url?: string };
    },
  ) {
    super(message);
    this.name = 'HttpError';
    this.response = options?.response;
    this.config = options?.config;
  }
}

// A repeated POST or PATCH can apply twice (a second word rotation, a guess
// the API already took coming back as "already guessed"), so only these
// methods are retried unless a request opts in with `retries`.
const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'HEAD',
  'OPTIONS',
  'PUT',
  'DELETE',
]);

function isIdempotent(method: string | undefined): boolean {
  return IDEMPOTENT_METHODS.has((method ?? 'GET').toUpperCase());
}

export class HttpClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private defaultTimeout: number;
  private defaultRetries: number;
  private onRetry?: (message: string) => void;

  private requestInterceptors: Array<
    (config: RequestConfig) => RequestConfig | Promise<RequestConfig>
  > = [];
  private responseInterceptors: Array<{
    onFulfilled?: (response: Response) => Response | Promise<Response>;
    onRejected?: (error: unknown) => unknown;
  }> = [];

  constructor(options: HttpClientOptions = {}) {
    this.baseURL = options.baseURL || '';
    this.defaultHeaders = options.headers || {};
    this.defaultTimeout = options.timeout || 15000;
    this.onRetry = options.onRetry;
    this.defaultRetries =
      typeof options.retries === 'number' ? options.retries : 3;
  }

  public interceptors = {
    request: {
      use: (
        interceptor: (
          config: RequestConfig,
        ) => RequestConfig | Promise<RequestConfig>,
      ) => {
        this.requestInterceptors.push(interceptor);
      },
    },
    response: {
      use: (
        onFulfilled?: (response: Response) => Response | Promise<Response>,
        onRejected?: (error: unknown) => unknown,
      ) => {
        this.responseInterceptors.push({ onFulfilled, onRejected });
      },
    },
  };

  private async applyRequestInterceptors(
    config: RequestConfig,
  ): Promise<RequestConfig> {
    let finalConfig = { ...config };
    for (const interceptor of this.requestInterceptors) {
      finalConfig = await interceptor(finalConfig);
    }
    return finalConfig;
  }

  private async applyResponseInterceptors(
    response: Response,
  ): Promise<Response> {
    let finalResponse = response;
    for (const interceptor of this.responseInterceptors) {
      if (interceptor.onFulfilled) {
        finalResponse = await interceptor.onFulfilled(finalResponse);
      }
    }
    return finalResponse;
  }

  private async applyResponseErrorInterceptors(error: unknown): Promise<never> {
    let finalError = error;
    for (const interceptor of this.responseInterceptors) {
      if (interceptor.onRejected) {
        try {
          await interceptor.onRejected(finalError);
        } catch (e) {
          finalError = e;
        }
      }
    }
    throw finalError;
  }

  /** Races a promise against a timeout. Rejects with an Error if the timeout fires first. */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Body read timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]).finally(() => clearTimeout(timer));
  }

  private exponentialBackoff(attempt: number): Promise<void> {
    const delay = Math.min(Math.pow(2, attempt) * 1000, 10000); // Max delay of 10s
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async fetchWithRetry(
    url: string,
    config: RequestConfig,
    attempt: number = 0,
  ): Promise<Response> {
    const timeout = config.timeout ?? this.defaultTimeout;
    const retries =
      config.retries ?? (isIdempotent(config.method) ? this.defaultRetries : 0);
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeout);

    const fetchConfig: RequestInit = {
      ...config,
      signal: abortController.signal,
    };

    try {
      const response = await fetch(url, fetchConfig);
      clearTimeout(timeoutId);

      // Retry on 5xx server errors
      if (response.status >= 500 && attempt < retries) {
        this.onRetry?.(
          `Received ${response.status} from ${url}. Retrying... (${attempt + 1}/${retries})`,
        );
        await this.exponentialBackoff(attempt);
        return this.fetchWithRetry(url, config, attempt + 1);
      }

      // Check if response is not ok
      if (!response.ok) {
        const errorText = await response.text();
        let errorData: unknown = errorText;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // keep as string
        }
        throw new HttpError(
          `HTTP error! status: ${response.status}, message: ${errorText}`,
          {
            response: { status: response.status, data: errorData },
            config: { url },
          },
        );
      }

      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      // Retry on network errors or timeouts
      const isRetryable =
        error instanceof TypeError || // Network errors often throw TypeError in fetch
        (error instanceof Error && error.name === 'AbortError');

      if (isRetryable && attempt < retries) {
        this.onRetry?.(
          `Network error or timeout on ${url}. Retrying... (${attempt + 1}/${retries})`,
        );
        await this.exponentialBackoff(attempt);
        return this.fetchWithRetry(url, config, attempt + 1);
      }

      if (error instanceof HttpError) {
        error.config ??= { url };
        throw error;
      }

      if (error instanceof Error) {
        throw new HttpError(error.message, { config: { url } });
      }

      throw error;
    }
  }

  public async request(
    endpoint: string,
    options: RequestConfig = {},
  ): Promise<unknown> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseURL}${endpoint}`;

    let config: RequestConfig = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
      url,
    };

    config = await this.applyRequestInterceptors(config);

    try {
      let response = await this.fetchWithRetry(config.url || url, config);
      response = await this.applyResponseInterceptors(response);

      const bodyTimeout = config.timeout ?? this.defaultTimeout;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await this.withTimeout(response.json(), bodyTimeout);
      }
      return await this.withTimeout(response.text(), bodyTimeout);
    } catch (error) {
      return this.applyResponseErrorInterceptors(error);
    }
  }

  public async get(
    endpoint: string,
    options?: Omit<RequestConfig, 'method'>,
  ): Promise<unknown> {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  public async post(
    endpoint: string,
    data?: unknown,
    options?: Omit<RequestConfig, 'method' | 'body'>,
  ): Promise<unknown> {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  public async put(
    endpoint: string,
    data?: unknown,
    options?: Omit<RequestConfig, 'method' | 'body'>,
  ): Promise<unknown> {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  public async delete(
    endpoint: string,
    options?: Omit<RequestConfig, 'method'>,
  ): Promise<unknown> {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export function callContract<C extends EndpointContract>(
  http: HttpClient,
  contract: C,
  request: ContractRequest<C>,
  options?: Omit<RequestConfig, 'method' | 'body'>,
): Promise<ContractResponse<C>>;
export async function callContract(
  http: HttpClient,
  contract: EndpointContract,
  request: ContractRequestParts,
  options?: Omit<RequestConfig, 'method' | 'body'>,
): Promise<unknown> {
  const url = contractUrl(contract, request.params, request.query);
  const hasBody = request.body !== undefined;
  const raw = await http.request(url, {
    ...options,
    method: contract.method,
    body: hasBody ? JSON.stringify(request.body) : undefined,
    headers: hasBody
      ? { 'Content-Type': 'application/json', ...options?.headers }
      : options?.headers,
  });
  return contract.response.parse(raw);
}
