import { useState, useRef, useCallback, useEffect } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { PageHeader } from '@/components/ui/Common';
import { Upload, FileJson, CheckCircle, AlertCircle, X, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface ImportedKnowledge {
  id: string;
  subjectId: string;
  chapterId?: string;
  name: string;
  explanation: string;
  proficiency?: string;
  source?: string;
  keywords?: string[];
  raw_text?: string;
}

interface ImportedQuestion {
  id: string;
  knowledgePointId: string;
  subjectId: string;
  type: 'single_choice' | 'multi_choice' | 'true_false';
  stem: string;
  options: { id: string; text: string }[];
  correctAnswers: string[];
  explanation?: string;
}

const cleanOptionPrefix = (text: string): string => {
  return text.replace(/^[A-G]\.\s*/, '').trim();
};

interface ImportResult {
  totalKP: number;
  successKP: number;
  duplicateKP: number;
  invalidKP: number;
  totalQ: number;
  successQ: number;
  duplicateQ: number;
  invalidQ: number;
}

export default function ImportKnowledgePage() {
  const { navigate } = useUser();
  const { learningState, learningDispatch, recordHistory } = useLearning();
  const { theme } = useTheme();

  // 动画效果 - 使用次级界面动画设置
  const [animationEffect, setAnimationEffect] = useState(() => {
    const saved = localStorage.getItem('sub-animation-effect');
    return saved || 'fade-in';
  });

  // 监听动画效果变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sub-animation-effect' && e.newValue) {
        setAnimationEffect(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 获取动画类名
  const getAnimationClass = (delay: number) => {
    const baseClass = `scroll-${animationEffect}`;
    const delayClass = `reveal-delay-${delay}`;
    return `${baseClass} ${delayClass}`;
  };

  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [jsonInput, setJsonInput] = useState('');
  const [parsedData, setParsedData] = useState<ImportedKnowledge[]>([]);
  const [parsedQuestions, setParsedQuestions] = useState<ImportedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingDuplicateCount, setPendingDuplicateCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseJson = useCallback((jsonStr: string): { knowledgePoints: ImportedKnowledge[]; questions: ImportedQuestion[] } => {
    try {
      const data = JSON.parse(jsonStr);
      let knowledgePoints: ImportedKnowledge[] = [];
      let questions: ImportedQuestion[] = [];

      if (Array.isArray(data)) {
        knowledgePoints = data;
      } else {
        if (data.knowledgePoints && Array.isArray(data.knowledgePoints)) {
          knowledgePoints = data.knowledgePoints;
        }
        if (data.questions && Array.isArray(data.questions)) {
          questions = data.questions.map((q: any) => ({
            ...q,
            stem: q.stem,
            options: q.options.map((opt: any) => ({
              id: opt.id,
              text: cleanOptionPrefix(opt.text || opt.label || ''),
            })),
          }));
        }
        if (data.data && Array.isArray(data.data)) {
          knowledgePoints = data.data;
        }
      }

      if (knowledgePoints.length === 0 && questions.length === 0) {
        throw new Error('JSON 格式不正确，应为数组或包含 knowledgePoints/questions 属性的对象');
      }

      return { knowledgePoints, questions };
    } catch (e) {
      throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : '未知错误'}`);
    }
  }, []);

  const validateItem = useCallback((item: any, index: number): { valid: boolean; error?: string } => {
    if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
      return { valid: false, error: `第 ${index + 1} 项：缺少有效的知识点名称` };
    }
    if (!item.subjectId || typeof item.subjectId !== 'string') {
      return { valid: false, error: `第 ${index + 1} 项：缺少有效的学科 ID` };
    }
    const subjectExists = learningState.subjects.some(s => s.id === item.subjectId);
    if (!subjectExists) {
      return { valid: false, error: `第 ${index + 1} 项：学科 ID "${item.subjectId}" 不存在` };
    }
    return { valid: true };
  }, [learningState.subjects]);

  const handleFileUpload = useCallback((file: File) => {
    if (!file.name.endsWith('.json') && !file.name.endsWith('.txt')) {
      setError('请上传 JSON 或 TXT 文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const { knowledgePoints, questions } = parseJson(content);
        setParsedData(knowledgePoints);
        setParsedQuestions(questions);
        setError(null);
        setImportResult(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : '文件解析失败');
        setParsedData([]);
        setParsedQuestions([]);
      }
    };
    reader.onerror = () => {
      setError('文件读取失败');
    };
    reader.readAsText(file);
  }, [parseJson]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handlePasteSubmit = useCallback(() => {
    if (!jsonInput.trim()) {
      setError('请输入 JSON 数据');
      return;
    }
    try {
      const { knowledgePoints, questions } = parseJson(jsonInput);
      setParsedData(knowledgePoints);
      setParsedQuestions(questions);
      setError(null);
      setImportResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'JSON 解析失败');
      setParsedData([]);
      setParsedQuestions([]);
    }
  }, [jsonInput, parseJson]);

  const checkDuplicates = useCallback((items: ImportedKnowledge[]): Set<string> => {
    const existingNames = new Set(learningState.knowledgePoints.map(kp => kp.name.toLowerCase()));
    return new Set(items.filter(item => existingNames.has(item.name.toLowerCase())).map(item => item.id));
  }, [learningState.knowledgePoints]);

  const checkAndShowDuplicateDialog = useCallback(() => {
    const duplicates = checkDuplicates(parsedData);
    if (duplicates.size > 0) {
      setPendingDuplicateCount(duplicates.size);
      setShowDuplicateDialog(true);
    } else {
      handleImportWithMode('skip');
    }
  }, [parsedData, checkDuplicates]);

  const handleImportWithMode = useCallback((mode: 'skip' | 'overwrite') => {
    setShowDuplicateDialog(false);

    recordHistory();

    let successKP = 0;
    let duplicateKP = 0;
    let invalidKP = 0;

    const duplicates = checkDuplicates(parsedData);

    parsedData.forEach((item, index) => {
      const validation = validateItem(item, index);

      if (!validation.valid) {
        invalidKP++;
        return;
      }

      const isDuplicate = duplicates.has(item.id);

      if (isDuplicate) {
        if (mode === 'overwrite') {
          const oldKP = learningState.knowledgePoints.find(kp =>
            item.name.toLowerCase() === kp.name.toLowerCase()
          );
          if (oldKP) {
            learningDispatch({ type: 'DELETE_KNOWLEDGE_POINT', payload: oldKP.id });
          }
        } else {
          duplicateKP++;
          return;
        }
      }

      const newKP = {
        id: item.id || `kp-import-${Date.now()}-${index}`,
        subjectId: item.subjectId,
        chapterId: item.chapterId || 'auto',
        name: item.name.trim(),
        explanation: (item.explanation || item.raw_text || '').trim(),
        proficiency: (item.proficiency as any) || 'none',
        source: (item.source as any) || 'import',
        lastReviewedAt: null,
        nextReviewAt: new Date().toISOString(),
        reviewCount: 0,
        createdAt: new Date().toISOString(),
      };

      learningDispatch({ type: 'ADD_KNOWLEDGE_POINT', payload: newKP });
      successKP++;
    });

    let successQ = 0;
    let duplicateQ = 0;
    let invalidQ = 0;

    const existingQuestionIds = new Set(learningState.questions.map(q => q.id));

    parsedQuestions.forEach((q, index) => {
      if (!q.stem || !q.options || q.options.length === 0 || !q.correctAnswers || q.correctAnswers.length === 0) {
        invalidQ++;
        return;
      }

      if (existingQuestionIds.has(q.id)) {
        duplicateQ++;
        return;
      }

      const newQuestion = {
        id: q.id || `q-import-${Date.now()}-${index}`,
        knowledgePointId: q.knowledgePointId,
        subjectId: q.subjectId,
        type: q.type,
        stem: q.stem,
        options: q.options,
        correctAnswers: q.correctAnswers,
        explanation: q.explanation || '',
      };

      learningDispatch({ type: 'AI_ADD_GENERATED_QUESTION', payload: newQuestion });
      successQ++;
    });

    setImportResult({
      totalKP: parsedData.length,
      successKP,
      duplicateKP,
      invalidKP,
      totalQ: parsedQuestions.length,
      successQ,
      duplicateQ,
      invalidQ,
    });
  }, [parsedData, parsedQuestions, validateItem, checkDuplicates, learningDispatch, learningState.questions, learningState.knowledgePoints, recordHistory]);

  const toggleExpand = useCallback((index: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setParsedData([]);
    setParsedQuestions([]);
    setError(null);
    setImportResult(null);
    setJsonInput('');
  }, []);

  const duplicates = checkDuplicates(parsedData);
  const validItems = parsedData.filter((item, index) => validateItem(item, index).valid);

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="导入知识库" onBack={() => navigate('knowledge')} />

      <div className={`px-4 pt-4 space-y-4 ${getAnimationClass(1)}`}>
        <div className="flex gap-2 rounded-xl p-1" style={{ backgroundColor: theme.border }}>
          <button
            onClick={() => { setMode('file'); handleClear(); }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              mode === 'file' ? '' : ''
            }`}
            style={{
              backgroundColor: mode === 'file' ? theme.bgCard : 'transparent',
              color: mode === 'file' ? theme.primary : theme.textSecondary,
              boxShadow: mode === 'file' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <Upload size={16} />
            上传文件
          </button>
          <button
            onClick={() => { setMode('paste'); handleClear(); }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              mode === 'paste' ? '' : ''
            }`}
            style={{
              backgroundColor: mode === 'paste' ? theme.bgCard : 'transparent',
              color: mode === 'paste' ? theme.primary : theme.textSecondary,
              boxShadow: mode === 'paste' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <FileJson size={16} />
            粘贴 JSON
          </button>
        </div>

        {mode === 'file' && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors"
            style={{
              borderColor: isDragging ? theme.primary : theme.border,
              backgroundColor: isDragging ? `${theme.primary}08` : 'transparent'
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="hidden"
            />
            <Upload size={40} className="mx-auto mb-3" style={{ color: theme.textMuted }} />
            <p className="text-sm font-medium mb-1" style={{ color: theme.textPrimary }}>
              {isDragging ? '松开以上传' : '拖拽文件到此处'}
            </p>
            <p className="text-xs" style={{ color: theme.textMuted }}>
              或点击选择文件（支持 JSON/TXT）
            </p>
          </div>
        )}

        {mode === 'paste' && (
          <div className="space-y-3">
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder={`粘贴 JSON 数据...\n\n支持格式：\n1. 数组: [{ "name": "...", "subjectId": "...", ... }]\n2. 对象: { "knowledgePoints": [...] }`}
              rows={10}
              className="w-full rounded-xl px-4 py-3 text-sm font-mono outline-none transition-colors resize-none"
              style={{
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.bgCard,
                color: theme.textPrimary
              }}
            />
            <button
              onClick={handlePasteSubmit}
              className="w-full font-medium py-2.5 rounded-xl text-sm transition-colors"
              style={{ backgroundColor: theme.border, color: theme.textPrimary }}
            >
              解析 JSON
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: `1px solid rgba(239, 68, 68, 0.3)` }}>
            <AlertCircle size={20} style={{ color: '#ef4444' }} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
            </div>
            <button onClick={() => setError(null)} style={{ color: '#f87171' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {importResult && (
          <div className="rounded-xl p-4" style={{
            backgroundColor: (importResult.successKP > 0 || importResult.successQ > 0) ? 'rgba(34, 197, 94, 0.1)' : 'rgba(251, 191, 36, 0.1)',
            border: `1px solid ${(importResult.successKP > 0 || importResult.successQ > 0) ? 'rgba(34, 197, 94, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`
          }}>
            <div className="flex items-center gap-2 mb-3">
              {(importResult.successKP > 0 || importResult.successQ > 0) ? (
                <CheckCircle size={20} style={{ color: '#22c55e' }} />
              ) : (
                <AlertCircle size={20} style={{ color: '#f59e0b' }} />
              )}
              <span className="font-medium text-sm" style={{ color: theme.textPrimary }}>
                {(importResult.successKP > 0 || importResult.successQ > 0) ? '导入完成' : '导入结果'}
              </span>
            </div>

            <div className="mb-3">
              <p className="text-xs font-medium mb-2" style={{ color: theme.textSecondary }}>知识点导入结果</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { value: importResult.totalKP, color: '#6b7280', label: '总数量' },
                  { value: importResult.successKP, color: '#22c55e', label: '成功' },
                  { value: importResult.duplicateKP, color: '#f59e0b', label: '重复' },
                  { value: importResult.invalidKP, color: '#ef4444', label: '无效' }
                ].map((item, i) => (
                  <div key={i} className="rounded-lg p-2" style={{ backgroundColor: theme.bgCard }}>
                    <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
                    <p className="text-[10px]" style={{ color: theme.textMuted }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {importResult.totalQ > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium mb-2" style={{ color: theme.textSecondary }}>题目导入结果</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { value: importResult.totalQ, color: '#6b7280', label: '总数量' },
                    { value: importResult.successQ, color: '#22c55e', label: '成功' },
                    { value: importResult.duplicateQ, color: '#f59e0b', label: '重复' },
                    { value: importResult.invalidQ, color: '#ef4444', label: '无效' }
                  ].map((item, i) => (
                    <div key={i} className="rounded-lg p-2" style={{ backgroundColor: theme.bgCard }}>
                      <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
                      <p className="text-[10px]" style={{ color: theme.textMuted }}>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(importResult.successKP > 0 || importResult.successQ > 0) && (
              <button
                onClick={() => navigate('knowledge')}
                className="w-full mt-3 font-medium py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: theme.primary, color: '#ffffff' }}
              >
                查看知识库
              </button>
            )}
          </div>
        )}

        {parsedData.length > 0 && !importResult && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium" style={{ color: theme.textPrimary }}>数据预览</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: theme.textMuted }}>
                  知识点: {validItems.length}/{parsedData.length} 有效
                  {parsedQuestions.length > 0 && ` | 题目: ${parsedQuestions.length} 个`}
                </span>
                <button
                  onClick={handleClear}
                  className="p-1.5 rounded-lg"
                  style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {parsedData.slice(0, 50).map((item, index) => {
                const validation = validateItem(item, index);
                const isValid = validation.valid;
                const isDuplicate = !isValid ? false : duplicates.has(item.id);
                const isExpanded = expandedItems.has(index);

                return (
                  <div
                    key={item.id || index}
                    className="rounded-xl border overflow-hidden"
                    style={{
                      borderColor: !isValid ? 'rgba(239, 68, 68, 0.3)' : isDuplicate ? 'rgba(251, 191, 36, 0.3)' : theme.border,
                      backgroundColor: !isValid ? 'rgba(239, 68, 68, 0.05)' : isDuplicate ? 'rgba(251, 191, 36, 0.05)' : theme.bgCard
                    }}
                  >
                    <button
                      onClick={() => toggleExpand(index)}
                      className="w-full p-3 flex items-center justify-between text-left"
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="flex items-center gap-2">
                          {!isValid ? (
                            <AlertCircle size={14} style={{ color: '#ef4444' }} className="shrink-0" />
                          ) : isDuplicate ? (
                            <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: 'rgba(251, 191, 36, 0.2)', color: '#d97706' }}>重复</span>
                          ) : (
                            <CheckCircle size={14} style={{ color: '#22c55e' }} className="shrink-0" />
                          )}
                          <span className="text-sm font-medium truncate" style={{ color: theme.textPrimary }}>{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px]" style={{ color: theme.textMuted }}>
                            {learningState.subjects.find(s => s.id === item.subjectId)?.name || item.subjectId}
                          </span>
                          {!isValid && (
                            <span className="text-[10px]" style={{ color: '#ef4444' }}>{validation.error}</span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={16} style={{ color: theme.textMuted }} className="shrink-0" />
                      ) : (
                        <ChevronDown size={16} style={{ color: theme.textMuted }} className="shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 pt-2" style={{ borderTop: `1px solid ${theme.border}` }}>
                        <p className="text-xs mb-1" style={{ color: theme.textMuted }}>解释：</p>
                        <p className="text-xs leading-relaxed" style={{ color: theme.textSecondary }}>
                          {item.explanation || item.raw_text || '(无)'}
                        </p>
                        {item.keywords && item.keywords.length > 0 && (
                          <>
                            <p className="text-xs mb-1 mt-2" style={{ color: theme.textMuted }}>关键词：</p>
                            <div className="flex flex-wrap gap-1">
                              {item.keywords.map((kw, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: theme.border, color: theme.textSecondary }}>
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {parsedData.length > 50 && (
                <div className="text-center py-2 text-xs" style={{ color: theme.textMuted }}>
                  还有 {parsedData.length - 50} 项未显示...
                </div>
              )}
            </div>

            {validItems.length > 0 && (
              <button
                onClick={checkAndShowDuplicateDialog}
                className="w-full font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: theme.primary, color: '#ffffff' }}
              >
                <Plus size={18} />
                导入 {validItems.length} 个知识点
                {parsedQuestions.length > 0 && ` + ${parsedQuestions.length} 个题目`}
              </button>
            )}

            {showDuplicateDialog && (
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                <div className="rounded-2xl p-6 max-w-sm w-full" style={{ backgroundColor: theme.bgCard }}>
                  <h3 className="text-lg font-bold mb-2" style={{ color: theme.textPrimary }}>检测到重复内容</h3>
                  <p className="text-sm mb-4" style={{ color: theme.textSecondary }}>
                    发现 {pendingDuplicateCount} 个重复的知识点，请选择处理方式：
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={() => handleImportWithMode('skip')}
                      className="w-full font-medium py-3 rounded-xl text-sm"
                      style={{ backgroundColor: theme.border, color: theme.textPrimary }}
                    >
                      跳过重复项
                    </button>
                    <button
                      onClick={() => handleImportWithMode('overwrite')}
                      className="w-full font-medium py-3 rounded-xl text-sm"
                      style={{ backgroundColor: '#f59e0b', color: '#ffffff' }}
                    >
                      覆盖重复项
                    </button>
                    <button
                      onClick={() => setShowDuplicateDialog(false)}
                      className="w-full text-sm py-2"
                      style={{ color: theme.textMuted }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {parsedData.length === 0 && (
          <div className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard }}>
            <h4 className="text-xs font-medium mb-2" style={{ color: theme.textSecondary }}>可用学科参考</h4>
            <div className="flex flex-wrap gap-2">
              {learningState.subjects.map(s => (
                <span key={s.id} className="text-xs px-2 py-1 rounded-lg border" style={{ backgroundColor: theme.bgCard, borderColor: theme.border, color: theme.textSecondary }}>
                  {s.icon} {s.id}
                </span>
              ))}
            </div>
          </div>
        )}

        {parsedData.length === 0 && (
          <div className="text-xs space-y-2" style={{ color: theme.textMuted }}>
            <p className="font-medium" style={{ color: theme.textSecondary }}>导入格式说明：</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>支持包含 <code className="px-1 rounded" style={{ backgroundColor: theme.border }}>knowledgePoints</code> 和 <code className="px-1 rounded" style={{ backgroundColor: theme.border }}>questions</code> 的对象</li>
              <li>每个知识点需包含 <code className="px-1 rounded" style={{ backgroundColor: theme.border }}>name</code>（名称）和 <code className="px-1 rounded" style={{ backgroundColor: theme.border }}>subjectId</code>（学科ID）</li>
              <li>题目需包含 <code className="px-1 rounded" style={{ backgroundColor: theme.border }}>stem</code>、<code className="px-1 rounded" style={{ backgroundColor: theme.border }}>options</code>、<code className="px-1 rounded" style={{ backgroundColor: theme.border }}>correctAnswers</code></li>
              <li>重复的知识点名称和题目ID会自动跳过</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
