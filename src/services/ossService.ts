/**
 * 阿里云 OSS 服务 - 从云端下载知识库
 */

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

/**
 * 从 OSS 下载知识库数据
 */
export async function downloadKnowledgeFromOSS(
  subjectId: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<{
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
 * 获取可下载的知识库列表
 */
export async function getAvailableKnowledgeBases(): Promise<KnowledgeSubject[]> {
  // 这里硬编码可用的知识库列表
  // 后期可以改成从 metadata.json 动态读取
  return [
    {
      id: 'micro',
      name: '微生物与免疫学',
      description: '包含 20 个知识点 + 20 道题目',
      kpCount: 20,
      qCount: 20
    },
    {
      id: 'immuno',
      name: '免疫学题目',
      description: '包含 12 个知识点 + 12 道题目',
      kpCount: 12,
      qCount: 12
    },
    {
      id: 'tcm',
      name: '中药学',
      description: '中药学知识库',
      kpCount: 0,
      qCount: 0
    },
    {
      id: 'fangji',
      name: '方剂学',
      description: '方剂学知识库',
      kpCount: 0,
      qCount: 0
    }
  ];
}

/**
 * 获取 OSS 知识库的公开 URL
 */
export function getKnowledgeURL(subjectId: string): string {
  return `${OSS_CONFIG.baseUrl}/knowledge/${subjectId}/index.json`;
}
