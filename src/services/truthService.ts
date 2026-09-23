import { API_BASE, apiFetch } from '@/services/aiClient';
import type {
  TruthAsset,
  TruthAssetStatus,
  TruthReport,
  TruthSearchFilter,
  TruthSearchResult,
} from '@/types';

export class TruthRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'TruthRequestError';
  }
}

async function requestError(response: Response): Promise<TruthRequestError> {
  const message = (await response.json().catch(() => null))?.error;
  return new TruthRequestError(response.status === 401 ? '登录已过期，请重新登录后查看资料。' : message || '求真服务请求失败，请重试。', response.status);
}

async function truthRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw await requestError(response);
  }
  return response.json();
}

export interface TruthStatus {
  enabled: boolean;
  isAdmin: boolean;
  role?: 'user' | 'sub_admin' | 'admin' | 'super_admin';
  permissions?: string[];
  limits: {
    maxFiles: number;
    maxFileBytes: number;
    acceptedTypes: string[];
  };
}

function resolveAssetUrl(url: string): string {
  if (!/^https?:\/\//i.test(API_BASE)) return url;
  return new URL(url, API_BASE).toString();
}

function resolveAsset(asset: TruthAsset): TruthAsset {
  return {
    ...asset,
    previewUrl: resolveAssetUrl(asset.previewUrl),
    originalUrl: resolveAssetUrl(asset.originalUrl),
    downloadUrl: resolveAssetUrl(asset.downloadUrl),
    attachments: asset.attachments?.map(attachment => ({
      ...attachment,
      previewUrl: attachment.previewUrl ? resolveAssetUrl(attachment.previewUrl) : undefined,
      downloadUrl: resolveAssetUrl(attachment.downloadUrl),
    })),
  };
}

export function fetchTruthStatus(): Promise<TruthStatus> {
  return truthRequest('/truth/status');
}

export async function searchTruth(query: string, filter?: TruthSearchFilter): Promise<TruthSearchResult> {
  const result = await truthRequest<TruthSearchResult>('/truth/search', {
    method: 'POST',
    body: JSON.stringify({ query, filter }),
  });
  return { ...result, assets: result.assets.map(resolveAsset) };
}

export async function fetchTruthLibrary(input: {
  query?: string;
  filter?: TruthSearchFilter;
  offset?: number;
  limit?: number;
}, signal?: AbortSignal): Promise<TruthSearchResult> {
  const params = new URLSearchParams({ query: input.query || '', offset: String(input.offset || 0), limit: String(input.limit || 24) });
  Object.entries(input.filter || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') params.set(key, String(value));
  });
  const result = await truthRequest<TruthSearchResult>(`/truth/library?${params}`, { signal });
  return { ...result, assets: result.assets.map(resolveAsset) };
}

// All protected media uses the same cookie and bearer-token transport as JSON requests.
export async function fetchTruthBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  const target = new URL(resolveAssetUrl(url), window.location.origin);
  const api = new URL(API_BASE, window.location.origin);
  if (target.origin !== api.origin || !target.pathname.startsWith(`${api.pathname.replace(/\/$/, '')}/truth/`)) {
    throw new TruthRequestError('无效的求真资料地址。', 400);
  }
  const response = await apiFetch(target.toString(), { signal });
  if (!response.ok) {
    console.warn('求真资料加载失败', { status: response.status });
    throw await requestError(response);
  }
  return response.blob();
}

export async function downloadTruthFile(url: string, fileName: string, signal?: AbortSignal): Promise<void> {
  const blob = await fetchTruthBlob(url, signal);
  if (signal?.aborted) return;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Keep the URL alive until the browser has accepted the download, then release it.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function fetchTruthReports(signal?: AbortSignal): Promise<{ reports: TruthReport[] }> {
  return truthRequest('/truth/reports', { signal });
}

export function fetchTruthReport(id: string, signal?: AbortSignal): Promise<{ report: TruthReport }> {
  return truthRequest(`/truth/reports/${encodeURIComponent(id)}`, { signal });
}

export interface TruthUploadMetadata {
  common: Partial<TruthAsset>;
  items: Array<Partial<TruthAsset>>;
}

export async function uploadTruthAssets(
  files: File[],
  metadata: TruthUploadMetadata,
): Promise<{ created: TruthAsset[]; duplicates: Array<{ fileName: string; existing: TruthAsset }>; failed: Array<{ fileName: string; error: string }> }> {
  const body = new FormData();
  files.forEach(file => body.append('images', file));
  body.append('metadata', JSON.stringify(metadata));
  const result = await truthRequest<{
    created: TruthAsset[];
    duplicates: Array<{ fileName: string; existing: TruthAsset }>;
    failed: Array<{ fileName: string; error: string }>;
  }>('/truth/assets/upload', { method: 'POST', body });
  return {
    ...result,
    created: result.created.map(resolveAsset),
    duplicates: result.duplicates.map(item => ({ ...item, existing: resolveAsset(item.existing) })),
  };
}

export async function fetchTruthAssets(status?: TruthAssetStatus): Promise<{ assets: TruthAsset[] }> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const result = await truthRequest<{ assets: TruthAsset[] }>(`/truth/assets${query}`);
  return { assets: result.assets.map(resolveAsset) };
}

export async function updateTruthAsset(id: string, patch: Partial<TruthAsset>): Promise<{ asset: TruthAsset }> {
  const result = await truthRequest<{ asset: TruthAsset }>(`/truth/assets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return { asset: resolveAsset(result.asset) };
}

export async function publishTruthAsset(id: string): Promise<{ asset: TruthAsset }> {
  const result = await truthRequest<{ asset: TruthAsset }>(`/truth/assets/${id}/publish`, { method: 'POST' });
  return { asset: resolveAsset(result.asset) };
}

export async function submitTruthAsset(id: string): Promise<{ asset: TruthAsset }> {
  const result = await truthRequest<{ asset: TruthAsset }>(`/truth/assets/${id}/submit`, { method: 'POST' });
  return { asset: resolveAsset(result.asset) };
}

export async function archiveTruthAsset(id: string): Promise<{ asset: TruthAsset }> {
  const result = await truthRequest<{ asset: TruthAsset }>(`/truth/assets/${id}/archive`, { method: 'POST' });
  return { asset: resolveAsset(result.asset) };
}

export function createTruthReport(input: {
  assetIds: string[];
  title?: string;
  queryText?: string;
  filter?: TruthSearchFilter;
  assetVersions?: Record<string, number>;
}, signal?: AbortSignal): Promise<{ report: TruthReport }> {
  return truthRequest('/truth/reports', {
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  });
}

export function truthPdfUrl(reportId: string): string {
  return `${API_BASE}/truth/reports/${encodeURIComponent(reportId)}/pdf`;
}
