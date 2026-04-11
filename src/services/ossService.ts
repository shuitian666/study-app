/**
 * 阿里云 OSS 服务 - 从云端下载知识库
 */

import type { Chapter } from '@/types';

// OSS 配置（公开访问的 Bucket）
const OSS_CONFIG = {
  bucket: 'zhixuestudy',
  region: 'oss-cn-beijing',
  baseUrl: 'https://zhixuestudy.oss-cn-beijing.aliyuncs.com'
};

// 知识库元数据
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
  progress: number; // 0-100
  message: string;
  downloadedCount?: number;
  totalCount?: number;
}

// 简单的内存缓存
let metadataCache: KnowledgeMetadata | null = null;
let metadataCacheTime: number = 0;
const METADATA_CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

/**
 * 从 OSS 获取知识库元数据
 */
export async function getKnowledgeMetadata(
  forceRefresh: boolean = false
): Promise<KnowledgeMetadata | null> {
  // 检查缓存
  const now = Date.now();
  if (!forceRefresh && metadataCache && (now - metadataCacheTime) < METADATA_CACHE_TTL) {
    console.log('[OSS] 使用缓存的 metadata');
    return metadataCache;
  }

  try {
    console.log('[OSS] 从云端获取 metadata...');
    const url = `${OSS_CONFIG.baseUrl}/knowledge/metadata.json`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[OSS] metadata.json 不存在，使用默认列表');
        return getFallbackMetadata();
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    metadataCache = data;
    metadataCacheTime = now;
    console.log('[OSS] 成功获取 metadata');
    return data;
  } catch (error) {
    console.error('[OSS] 获取 metadata 失败:', error);
    return getFallbackMetadata();
  }
}

/**
 * 获取备用的知识库列表（当云端不可用时）
 */
function getFallbackMetadata(): KnowledgeMetadata {
  return {
    version: '0.0.0',
    lastUpdated: new Date().toISOString(),
    subjects: [
      {
        id: 'micro',
        name: '微生物与免疫学',
        icon: '🦠',
        color: '#059669',
        description: '包含 20 个知识点 + 20 道题目',
        kpCount: 20,
        qCount: 20
      },
      {
        id: 'immuno',
        name: '免疫学题目',
        icon: '🔬',
        color: '#8b5cf6',
        description: '包含 12 个知识点 + 12 道题目',
        kpCount: 12,
        qCount: 12
      },
      {
        id: 'tcm',
        name: '中药学',
        icon: '🌿',
        color: '#10b981',
        description: '中药学知识库',
        kpCount: 0,
        qCount: 0
      },
      {
        id: 'fangji',
        name: '方剂学',
        icon: '📚',
        color: '#f59e0b',
        description: '方剂学知识库',
        kpCount: 0,
        qCount: 0
      }
    ]
  };
}

/**
 * 获取可下载的知识库列表（兼容旧接口）
 */
export async function getAvailableKnowledgeBases(): Promise<KnowledgeSubject[]> {
  const metadata = await getKnowledgeMetadata();
  return metadata?.subjects || [];
}

/**
 * 从 OSS 下载知识库数据
 */
export async function downloadKnowledgeFromOSS(
  subjectId: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<{
  chapters: any[];
  knowledgePoints: any[];
  questions: any[];
} | null> {
  try {
    onProgress?.({
      status: 'downloading',
      progress: 10,
      message: '正在连接云端...'
    });

    const url = `${OSS_CONFIG.baseUrl}/knowledge/${subjectId}/index.json`;
    console.log('[OSS] Downloading:', url);

    onProgress?.({
      status: 'downloading',
      progress: 30,
      message: '正在下载...'
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    onProgress?.({
      status: 'downloading',
      progress: 70,
      message: '正在解析数据...'
    });

    const data = await response.json();
    const total = data.knowledgePoints?.length || 0;

    onProgress?.({
      status: 'downloading',
      progress: 90,
      message: `下载完成，共 ${total} 个知识点`,
      downloadedCount: total,
      totalCount: total
    });

    console.log('[OSS] Downloaded:', data.total, 'knowledge points');

    onProgress?.({
      status: 'success',
      progress: 100,
      message: `成功下载 ${total} 个知识点`,
      downloadedCount: total,
      totalCount: total
    });

    return {
      chapters: data.chapters || [],
      knowledgePoints: data.knowledgePoints || [],
      questions: data.questions || []
    };
  } catch (error) {
    console.error('[OSS] Download failed:', error);
    onProgress?.({
      status: 'error',
      progress: 0,
      message: `下载失败: ${error instanceof Error ? error.message : '未知错误'}`
    });
    return null;
  }
}

/**
 * 获取 OSS 知识库的公开 URL
 */
export function getKnowledgeURL(subjectId: string): string {
  return `${OSS_CONFIG.baseUrl}/knowledge/${subjectId}/index.json`;
}

/**
 * 获取 OSS 资源文件的公开 URL
 */
export function getAssetURL(assetPath: string): string {
  return `${OSS_CONFIG.baseUrl}/${assetPath}`;
}

/**
 * 获取指定学科的完整信息（从metadata中）
 */
export async function getSubjectInfo(subjectId: string): Promise<KnowledgeSubject | null> {
  const metadata = await getKnowledgeMetadata();
  if (!metadata) return null;
  return metadata.subjects.find(s => s.id === subjectId) || null;
}

/**
 * 清除缓存
 */
export function clearMetadataCache(): void {
  metadataCache = null;
  metadataCacheTime = 0;
}
