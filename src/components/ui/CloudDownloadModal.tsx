/**
 * 云端下载弹窗组件
 */

import { useState, useEffect } from 'react';
import { X, Cloud, CloudDownload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getAvailableKnowledgeBases, downloadKnowledgeFromOSS, getSubjectInfo, type KnowledgeSubject, type DownloadProgress } from '@/services/ossService';

interface CloudDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (subjects: any[], chapters: any[], knowledgePoints: any[], questions: any[]) => void;
}

export default function CloudDownloadModal({ isOpen, onClose, onImport }: CloudDownloadModalProps) {
  const [subjects, setSubjects] = useState<KnowledgeSubject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    status: 'idle',
    progress: 0,
    message: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadSubjects();
    }
  }, [isOpen]);

  const loadSubjects = async () => {
    const list = await getAvailableKnowledgeBases();
    setSubjects(list);
    if (list.length > 0) {
      setSelectedId(list[0].id);
    }
  };

  const handleDownload = async () => {
    if (!selectedId) return;

    setDownloadProgress({
      status: 'downloading',
      progress: 0,
      message: '准备下载...'
    });

    // 同时获取subject信息和知识库数据
    const [subjectInfo, result] = await Promise.all([
      getSubjectInfo(selectedId),
      downloadKnowledgeFromOSS(selectedId, setDownloadProgress)
    ]);

    if (result && result.knowledgePoints.length > 0) {
      // 构建subject数组
      const subjectsToImport: any[] = [];
      if (subjectInfo) {
        subjectsToImport.push({
          id: subjectInfo.id,
          name: subjectInfo.name,
          icon: subjectInfo.icon,
          color: subjectInfo.color,
          knowledgePointCount: subjectInfo.kpCount || 0
        });
      }

      // 延迟关闭，让用户看到成功消息
      setTimeout(() => {
        onImport(subjectsToImport, result.chapters || [], result.knowledgePoints, result.questions);
        onClose();
        setDownloadProgress({ status: 'idle', progress: 0, message: '' });
      }, 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: 'var(--card-bg, #ffffff)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-color, #e5e5e5)' }}>
          <div className="flex items-center gap-2">
            <Cloud size={20} style={{ color: 'var(--primary, #3b82f6)' }} />
            <h3 className="font-bold" style={{ color: 'var(--text-primary, #1f2937)' }}>云端知识库</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} style={{ color: 'var(--text-secondary, #6b7280)' }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Subject List */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary, #6b7280)' }}>
              选择知识库
            </label>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {subjects.map(subject => (
                <button
                  key={subject.id}
                  onClick={() => setSelectedId(subject.id)}
                  className={`w-full p-3 rounded-xl text-left transition-all ${
                    selectedId === subject.id ? 'ring-2' : ''
                  }`}
                  style={{
                    backgroundColor: selectedId === subject.id ? 'var(--primary-light, #eff6ff)' : 'var(--card-bg, #f9fafb)',
                    borderColor: selectedId === subject.id ? (subject.color || 'var(--primary, #3b82f6)') : 'transparent',
                    border: '1px solid'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                        style={{ backgroundColor: (subject.color || 'var(--primary, #3b82f6)') + '20' }}
                      >
                        {subject.icon || '📚'}
                      </div>
                      <div>
                        <div className="font-medium text-sm" style={{ color: 'var(--text-primary, #1f2937)' }}>
                          {subject.name}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary, #6b7280)' }}>
                          {subject.description}
                        </div>
                        {(subject.kpCount || subject.qCount) && (
                          <div className="flex gap-3 mt-1">
                            {subject.kpCount && (
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--primary-light, #eff6ff)', color: 'var(--primary, #3b82f6)' }}>
                                {subject.kpCount} 知识点
                              </span>
                            )}
                            {subject.qCount && (
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
                                {subject.qCount} 题目
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedId === subject.id ? 'border-transparent' : ''
                      }`}
                      style={{
                        backgroundColor: selectedId === subject.id ? (subject.color || 'var(--primary, #3b82f6)') : 'transparent',
                        borderColor: selectedId === subject.id ? (subject.color || 'var(--primary, #3b82f6)') : 'var(--border-color, #d1d5db)'
                      }}
                    >
                      {selectedId === subject.id && (
                        <CheckCircle size={12} className="text-white" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Progress / Status */}
          {downloadProgress.status !== 'idle' && (
            <div
              className={`p-4 rounded-xl ${
                downloadProgress.status === 'success' ? 'bg-green-50' :
                downloadProgress.status === 'error' ? 'bg-red-50' : 'bg-blue-50'
              }`}
            >
              <div className="flex items-center gap-3">
                {downloadProgress.status === 'downloading' && (
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--primary, #3b82f6)' }} />
                )}
                {downloadProgress.status === 'success' && (
                  <CheckCircle size={20} style={{ color: '#10b981' }} />
                )}
                {downloadProgress.status === 'error' && (
                  <AlertCircle size={20} style={{ color: '#ef4444' }} />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary, #1f2937)' }}>
                    {downloadProgress.message}
                  </div>
                  {downloadProgress.status === 'downloading' && (
                    <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color, #e5e5e5)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${downloadProgress.progress}%`,
                          backgroundColor: 'var(--primary, #3b82f6)'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CORS Warning */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div className="text-xs" style={{ color: '#92400e' }}>
              <strong>注意：</strong>如果下载失败，请在阿里云 OSS 控制台添加 CORS 规则：
              <br />允许来源: *
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3" style={{ borderColor: 'var(--border-color, #e5e5e5)' }}>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors"
            style={{
              backgroundColor: 'var(--bg-secondary, #f3f4f6)',
              color: 'var(--text-primary, #1f2937)'
            }}
          >
            取消
          </button>
          <button
            onClick={handleDownload}
            disabled={!selectedId || downloadProgress.status === 'downloading'}
            className="flex-1 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              backgroundColor: selectedId ? (subjects.find(s => s.id === selectedId)?.color || 'var(--primary, #3b82f6)') : 'var(--primary, #3b82f6)',
              color: '#ffffff'
            }}
          >
            {downloadProgress.status === 'downloading' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                下载中...
              </>
            ) : (
              <>
                <CloudDownload size={16} />
                下载
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
