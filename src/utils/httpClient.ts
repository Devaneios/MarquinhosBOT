import { logger } from '@marquinhos/utils/logger';

export interface HttpClientOptions {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  url?: string;
}

export class HttpClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private defaultTimeout: number;
  private defaultRetries: number;

  private requestInterceptors: Array<(config: RequestConfig) => RequestConfig | Promise<RequestConfig>> = [];
  private responseInterceptors: Array<{
    onFulfilled?: (response: Response) => Response | Promise<Response>;
    onRejected?: (error: unknown) => unknown;
  }> = [];

  constructor(options: HttpClientOptions = {}) {
    this.baseURL = options.baseURL || '';
    this.defaultHeaders = options.headers || {};
    this.defaultTimeout = options.timeout || 15000;
    this.defaultRetries = typeof options.retries === 'number' ? options.retries : 3;
  }

  public interceptors = {
    request: {
      use: (interceptor: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>) => {
        this.requestInterceptors.push(interceptor);
      },
    },
    response: {
      use: (
        onFulfilled?: (response: Response) => Response | Promise<Response>,
        onRejected?: (error: unknown) => unknown
      ) => {
        this.responseInterceptors.push({ onFulfilled, onRejected });
      },
    },
  };

  private async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let finalConfig = { ...config };
    for (const interceptor of this.requestInterceptors) {
      finalConfig = await interceptor(finalConfig);
    }
    return finalConfig;
  }

  private async applyResponseInterceptors(response: Response): Promise<Response> {
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

  private exponentialBackoff(attempt: number): Promise<void> {
    const delay = Math.min(Math.pow(2, attempt) * 1000, 10000); // Max delay of 10s
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async fetchWithRetry(url: string, config: RequestConfig, attempt: number = 0): Promise<Response> {
    const timeout = config.timeout ?? this.defaultTimeout;
    const retries = config.retries ?? this.defaultRetries;
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
        logger.warn(`Received ${response.status} from ${url}. Retrying... (${attempt + 1}/${retries})`);
        await this.exponentialBackoff(attempt);
        return this.fetchWithRetry(url, config, attempt + 1);
      }

      // Check if response is not ok
      if (!response.ok) {
        const errorMsg = await response.text();
        const error = new Error(`HTTP error! status: ${response.status}, message: ${errorMsg}`);
        (error as any).response = { status: response.status, data: errorMsg };
        (error as any).config = { url };
        throw error;
      }

      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      // Retry on network errors or timeouts
      const isRetryable =
        error instanceof TypeError || // Network errors often throw TypeError in fetch
        (error instanceof Error && error.name === 'AbortError');

      if (isRetryable && attempt < retries) {
         logger.warn(`Network error or timeout on ${url}. Retrying... (${attempt + 1}/${retries})`);
         await this.exponentialBackoff(attempt);
         return this.fetchWithRetry(url, config, attempt + 1);
      }

      throw error;
    }
  }

  public async request<T = any>(endpoint: string, options: RequestConfig = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    
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
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        return data as T;
      }
      return response.text() as unknown as T;
      
    } catch (error) {
       return this.applyResponseErrorInterceptors(error);
    }
  }

  public async get<T = any>(endpoint: string, options?: Omit<RequestConfig, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public async post<T = any>(endpoint: string, data?: any, options?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  public async put<T = any>(endpoint: string, data?: any, options?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  public async delete<T = any>(endpoint: string, options?: Omit<RequestConfig, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

