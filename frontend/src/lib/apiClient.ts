import type { ApiError } from '@mha-bs/shared';

import { env } from './env.js';

/**
 * Client API centralise :
 *  - injecte le JWT depuis le store auth
 *  - retente automatiquement apres rafraichissement du token expire
 *  - normalise les erreurs en ApiClientError
 */

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  skipAuth?: boolean;
}

type TokenAccessor = () => { accessToken: string | null; refreshToken: string | null };
type TokenSetter = (accessToken: string, refreshToken: string) => void;
type LogoutFn = () => void;

let getTokens: TokenAccessor = () => ({ accessToken: null, refreshToken: null });
let setTokens: TokenSetter = () => {};
let onUnauthorized: LogoutFn = () => {};

export function configureApiClient(opts: {
  getTokens: TokenAccessor;
  setTokens: TokenSetter;
  onUnauthorized: LogoutFn;
}): void {
  getTokens = opts.getTokens;
  setTokens = opts.setTokens;
  onUnauthorized = opts.onUnauthorized;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = env.apiBaseUrl.replace(/\/$/, '');
  const fullPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${fullPath}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

async function rawFetch<T>(path: string, opts: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts.headers ?? {}),
  };

  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (!opts.skipAuth) {
    const { accessToken } = getTokens();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  const body =
    opts.body === undefined
      ? undefined
      : opts.body instanceof FormData
        ? opts.body
        : JSON.stringify(opts.body);

  const response = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    body,
    signal: opts.signal,
    credentials: 'include',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const apiError = payload as ApiError | null;
    throw new ApiClientError(
      response.status,
      apiError?.error?.code ?? 'HTTP_ERROR',
      apiError?.error?.message ?? `Erreur HTTP ${response.status}`,
      apiError?.error?.details,
    );
  }

  return payload as T;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  try {
    return await rawFetch<T>(path, opts);
  } catch (err) {
    // Si 401 et qu'on a un refresh token, on tente une seule fois le refresh
    if (err instanceof ApiClientError && err.status === 401 && !opts.skipAuth) {
      const { refreshToken } = getTokens();
      if (refreshToken) {
        try {
          const refreshed = await rawFetch<{ accessToken: string; refreshToken: string }>(
            '/auth/refresh',
            { method: 'POST', body: { refreshToken }, skipAuth: true },
          );
          setTokens(refreshed.accessToken, refreshed.refreshToken);
          return await rawFetch<T>(path, opts);
        } catch {
          onUnauthorized();
          throw err;
        }
      }
      onUnauthorized();
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'DELETE' }),
};
