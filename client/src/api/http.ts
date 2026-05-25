export const AUTH_UNAUTHORIZED_EVENT = 'crab:auth-unauthorized';
const DEFAULT_TIMEOUT_MS = 15000;
const PROJECT_STORAGE_KEY = 'crab-current-project';

// Base URL prefix for API calls (handles subpath deployments like /crabcreate/)
const BASE = import.meta.env.BASE_URL.replace(/\/$/, ''); // e.g. "/crabcreate"

type ResponseType = 'json' | 'text' | 'blob' | 'void';

export interface UnauthorizedDetail {
  status: number;
  url: string;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | null;
  jsonBody?: unknown;
  responseType?: ResponseType;
  includeProjectId?: boolean;
  requireProjectId?: boolean;
  timeoutMs?: number;
  sessionErrorMessage?: string;
  defaultErrorMessage?: string;
}

type ErrorPayload = {
  error?: unknown;
  message?: unknown;
  details?: unknown;
};

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      out[key] = value;
    }
    return out;
  }
  return { ...(headers as Record<string, string>) };
}

function hasHeader(headers: Record<string, string>, target: string): boolean {
  const lower = target.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
}

function setHeader(headers: Record<string, string>, key: string, value: string): void {
  const existing = Object.keys(headers).find((k) => k.toLowerCase() === key.toLowerCase());
  if (existing) {
    headers[existing] = value;
    return;
  }
  headers[key] = value;
}

function getDetailsMessage(details: unknown): string {
  if (!Array.isArray(details)) return '';
  const messages = details
    .map((detail) => {
      if (!detail || typeof detail !== 'object') return '';
      const msg = (detail as { message?: unknown }).message;
      return typeof msg === 'string' ? msg.trim() : '';
    })
    .filter(Boolean);
  return messages.join('. ');
}

async function parseErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers?.get?.('content-type') || '';
  const hasJsonBody = contentType.includes('application/json') || typeof (response as Partial<Response>).json === 'function';

  if (hasJsonBody) {
    const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
    if (!payload || typeof payload !== 'object') return '';
    const details = getDetailsMessage(payload.details);
    if (details) return details;
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
    return '';
  }

  if (typeof (response as Partial<Response>).text === 'function') {
    const text = await response.text().catch(() => '');
    return text.trim();
  }
  return '';
}

function readResponse<T>(response: Response, responseType: ResponseType): Promise<T> {
  if (responseType === 'void' || response.status === 204 || response.status === 205) {
    return Promise.resolve(undefined as T);
  }
  if (responseType === 'text') {
    if (typeof (response as Partial<Response>).text === 'function') {
      return response.text() as Promise<T>;
    }
    if (typeof (response as Partial<Response>).json === 'function') {
      return response.json() as Promise<T>;
    }
    return Promise.resolve('' as T);
  }
  if (responseType === 'blob') {
    if (typeof (response as Partial<Response>).blob === 'function') {
      return response.blob() as Promise<T>;
    }
    return Promise.resolve(new Blob([]) as T);
  }
  if (typeof (response as Partial<Response>).json === 'function') {
    return response.json() as Promise<T>;
  }
  return Promise.resolve(undefined as T);
}

function emitUnauthorized(url: string, status: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<UnauthorizedDetail>(AUTH_UNAUTHORIZED_EVENT, {
      detail: { status, url },
    }),
  );
}

export function getCurrentProjectId(): string | null {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY) || '';
    const value = raw.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    body,
    jsonBody,
    headers,
    responseType = 'json',
    includeProjectId = false,
    requireProjectId = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    sessionErrorMessage = 'Session expired',
    defaultErrorMessage = 'Request failed',
    credentials = 'include',
    ...rest
  } = options;

  const mergedHeaders = normalizeHeaders(headers);

  if (jsonBody !== undefined && !hasHeader(mergedHeaders, 'Content-Type')) {
    setHeader(mergedHeaders, 'Content-Type', 'application/json');
  }

  if (includeProjectId || requireProjectId) {
    const projectId = getCurrentProjectId();
    if (!projectId && requireProjectId) {
      throw new Error('Project context missing');
    }
    if (projectId) {
      setHeader(mergedHeaders, 'X-Project-Id', projectId);
    }
  }

  const requestOptions: RequestInit = {
    ...rest,
    credentials,
  };
  if (Object.keys(mergedHeaders).length > 0) {
    requestOptions.headers = mergedHeaders;
  }
  if (jsonBody !== undefined) {
    requestOptions.body = JSON.stringify(jsonBody);
  } else if (body !== undefined) {
    requestOptions.body = body;
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
  });

  try {
    const resolvedUrl = url.startsWith('/') ? `${BASE}${url}` : url;
    const response = (await Promise.race([fetch(resolvedUrl, requestOptions), timeoutPromise])) as Response;

    if (response.status === 401) {
      emitUnauthorized(url, 401);
      throw new Error(sessionErrorMessage);
    }

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw new Error(message || defaultErrorMessage || response.statusText || 'Request failed');
    }

    return await readResponse<T>(response, responseType);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export function apiJson<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>(url, { ...options, responseType: 'json' });
}

export function apiText(url: string, options: ApiRequestOptions = {}): Promise<string> {
  return apiRequest<string>(url, { ...options, responseType: 'text' });
}

export function apiBlob(url: string, options: ApiRequestOptions = {}): Promise<Blob> {
  return apiRequest<Blob>(url, { ...options, responseType: 'blob' });
}

export function apiVoid(url: string, options: ApiRequestOptions = {}): Promise<void> {
  return apiRequest<void>(url, { ...options, responseType: 'void' });
}
