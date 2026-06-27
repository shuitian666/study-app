import { API_BASE } from '@/services/aiClient';
import type {
  TruthAsset,
  TruthAssetStatus,
  TruthReport,
  TruthSearchFilter,
  TruthSearchResult,
} from '@/types';

async function truthRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error((await response.json().catch(() => null))?.error || '求真服务请求失败');
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
}): Promise<{ report: TruthReport }> {
  return truthRequest('/truth/reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function truthPdfUrl(reportId: string): string {
  return `${API_BASE}/truth/reports/${encodeURIComponent(reportId)}/pdf`;
}
