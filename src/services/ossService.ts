import type { Chapter, KnowledgePoint, Question } from '@/types';

const buildCloudURL = (path: string): string => {
  return path.startsWith('/') ? path : `/${path}`;
};

export interface KnowledgeSubject {
  id: string;
  name: string;
  description?: string;
  kpCount?: number;
  qCount?: number;
  icon?: string;
  color?: string;
  chapters?: Chapter[];
}

export interface KnowledgeMetadata {
  version: string;
  lastUpdated: string;
  subjects: KnowledgeSubject[];
}

export interface DownloadProgress {
  status: 'idle' | 'downloading' | 'success' | 'error';
  progress: number;
  message: string;
  downloadedCount?: number;
  totalCount?: number;
}

let metadataCache: KnowledgeMetadata | null = null;
let metadataCacheTime = 0;
const METADATA_CACHE_TTL = 5 * 60 * 1000;

function getFallbackMetadata(): KnowledgeMetadata {
  return {
    version: '0.0.0',
    lastUpdated: new Date().toISOString(),
    subjects: [
      {
        id: 'micro',
        name: '微生物与免疫学',
        icon: '🧫',
        color: '#059669',
        description: '微生物与免疫学知识库',
        kpCount: 0,
        qCount: 0,
      },
      {
        id: 'immuno',
        name: '免疫学题目',
        icon: '🔬',
        color: '#8b5cf6',
        description: '免疫学题目知识库',
        kpCount: 0,
        qCount: 0,
      },
      {
        id: 'analytical',
        name: '分析化学',
        icon: '⚗️',
        color: '#2563eb',
        description: '分析化学知识库',
        kpCount: 0,
        qCount: 0,
      },
    ],
  };
}

export async function getKnowledgeMetadata(
  forceRefresh = false,
): Promise<KnowledgeMetadata | null> {
  const now = Date.now();
  if (!forceRefresh && metadataCache && now - metadataCacheTime < METADATA_CACHE_TTL) {
    return metadataCache;
  }

  try {
    const url = buildCloudURL('/knowledge/metadata.json');
    const response = await fetch(url, { cache: forceRefresh ? 'reload' : 'default' });

    if (!response.ok) {
      if (response.status === 404) {
        return getFallbackMetadata();
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as KnowledgeMetadata;
    metadataCache = data;
    metadataCacheTime = now;
    return data;
  } catch (error) {
    console.error('[CloudStorage] Failed to fetch metadata:', error);
    return getFallbackMetadata();
  }
}

export async function getAvailableKnowledgeBases(): Promise<KnowledgeSubject[]> {
  const metadata = await getKnowledgeMetadata();
  return metadata?.subjects || [];
}

export async function downloadKnowledgeFromOSS(
  subjectId: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<{
  chapters: Chapter[];
  knowledgePoints: KnowledgePoint[];
  questions: Question[];
} | null> {
  try {
    onProgress?.({
      status: 'downloading',
      progress: 10,
      message: '正在连接云端...',
    });

    const url = buildCloudURL(`/knowledge/${subjectId}/index.json`);

    onProgress?.({
      status: 'downloading',
      progress: 30,
      message: '正在下载...',
    });

    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    onProgress?.({
      status: 'downloading',
      progress: 70,
      message: '正在解析数据...',
    });

    const data = await response.json() as Partial<{
      chapters: Chapter[];
      knowledgePoints: KnowledgePoint[];
      questions: Question[];
    }>;
    const total = data.knowledgePoints?.length || 0;

    onProgress?.({
      status: 'downloading',
      progress: 90,
      message: `下载完成，共 ${total} 个知识点`,
      downloadedCount: total,
      totalCount: total,
    });

    onProgress?.({
      status: 'success',
      progress: 100,
      message: `成功下载 ${total} 个知识点`,
      downloadedCount: total,
      totalCount: total,
    });

    return {
      chapters: data.chapters || [],
      knowledgePoints: data.knowledgePoints || [],
      questions: data.questions || [],
    };
  } catch (error) {
    console.error('[CloudStorage] Download failed:', error);
    onProgress?.({
      status: 'error',
      progress: 0,
      message: `下载失败: ${error instanceof Error ? error.message : '未知错误'}`,
    });
    return null;
  }
}

export function getKnowledgeURL(subjectId: string): string {
  return buildCloudURL(`/knowledge/${subjectId}/index.json`);
}

export function getAssetURL(assetPath: string): string {
  return buildCloudURL(assetPath);
}

export async function getSubjectInfo(subjectId: string): Promise<KnowledgeSubject | null> {
  const metadata = await getKnowledgeMetadata();
  if (!metadata) return null;
  return metadata.subjects.find(subject => subject.id === subjectId) || null;
}

export function clearMetadataCache(): void {
  metadataCache = null;
  metadataCacheTime = 0;
}
