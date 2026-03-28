import { useState, useRef, useCallback } from 'react';
import { useApp } from '@/store/AppContext';
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
  const { state, dispatch, navigate } = useApp();
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [jsonInput, setJsonInput] = useState('');
  const [parsedData, setParsedData] = useState<ImportedKnowledge[]>([]);
  const [parsedQuestions, setParsedQuestions] = useState<ImportedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse JSON from input
  const parseJson = useCallback((jsonStr: string): { knowledgePoints: ImportedKnowledge[]; questions: ImportedQuestion[] } => {
    try {
      const data = JSON.parse(jsonStr);
      let knowledgePoints: ImportedKnowledge[] = [];
      let questions: ImportedQuestion[] = [];

      // Handle different JSON formats
      if (Array.isArray(data)) {
        // Direct array of knowledge points
        knowledgePoints = data;
      } else {
        // Object with knowledgePoints and/or questions arrays
        if (data.knowledgePoints && Array.isArray(data.knowledgePoints)) {
          knowledgePoints = data.knowledgePoints;
        }
        if (data.questions && Array.isArray(data.questions)) {
          questions = data.questions;
        }
        // Fallback for { data: [...] }
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

  // Validate a knowledge item
  const validateItem = useCallback((item: any, index: number): { valid: boolean; error?: string } => {
    if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
      return { valid: false, error: `第 ${index + 1} 项：缺少有效的知识点名称` };
    }
    if (!item.subjectId || typeof item.subjectId !== 'string') {
      return { valid: false, error: `第 ${index + 1} 项：缺少有效的学科 ID` };
    }
    // Check if subject exists
    const subjectExists = state.subjects.some(s => s.id === item.subjectId);
    if (!subjectExists) {
      return { valid: false, error: `第 ${index + 1} 项：学科 ID "${item.subjectId}" 不存在` };
    }
    return { valid: true };
  }, [state.subjects]);

  // Handle file upload
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

  // Handle drag and drop
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

  // Handle paste mode
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

  // Check for duplicates
  const checkDuplicates = useCallback((items: ImportedKnowledge[]): Set<string> => {
    const existingNames = new Set(state.knowledgePoints.map(kp => kp.name.toLowerCase()));
    return new Set(items.filter(item => existingNames.has(item.name.toLowerCase())).map(item => item.id));
  }, [state.knowledgePoints]);

  // Import knowledge and questions
  const handleImport = useCallback(() => {
    let successKP = 0;
    let duplicateKP = 0;
    let invalidKP = 0;

    const duplicates = checkDuplicates(parsedData);

    // Import knowledge points
    parsedData.forEach((item, index) => {
      const validation = validateItem(item, index);
      
      if (!validation.valid) {
        invalidKP++;
        return;
      }

      if (duplicates.has(item.id)) {
        duplicateKP++;
        return;
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

      dispatch({ type: 'ADD_KNOWLEDGE_POINT', payload: newKP });
      successKP++;
    });

    // Import questions
    let successQ = 0;
    let duplicateQ = 0;
    let invalidQ = 0;

    const existingQuestionIds = new Set(state.questions.map(q => q.id));

    parsedQuestions.forEach((q, index) => {
      // Validate question
      if (!q.stem || !q.options || q.options.length === 0 || !q.correctAnswers || q.correctAnswers.length === 0) {
        invalidQ++;
        return;
      }

      // Check for duplicate
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

      dispatch({ type: 'AI_ADD_GENERATED_QUESTION', payload: newQuestion });
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
  }, [parsedData, parsedQuestions, validateItem, checkDuplicates, dispatch, state.questions]);

  // Toggle item expansion
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

  // Clear all
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

      <div className="px-4 pt-4 space-y-4">
        {/* Mode Toggle */}
        <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => { setMode('file'); handleClear(); }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              mode === 'file' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary'
            }`}
          >
            <Upload size={16} />
            上传文件
          </button>
          <button
            onClick={() => { setMode('paste'); handleClear(); }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              mode === 'paste' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary'
            }`}
          >
            <FileJson size={16} />
            粘贴 JSON
          </button>
        </div>

        {/* File Upload Mode */}
        {mode === 'file' && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="hidden"
            />
            <Upload size={40} className="mx-auto mb-3 text-text-muted" />
            <p className="text-sm font-medium text-text-primary mb-1">
              {isDragging ? '松开以上传' : '拖拽文件到此处'}
            </p>
            <p className="text-xs text-text-muted">
              或点击选择文件（支持 JSON/TXT）
            </p>
          </div>
        )}

        {/* Paste Mode */}
        {mode === 'paste' && (
          <div className="space-y-3">
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder={`粘贴 JSON 数据...\n\n支持格式：\n1. 数组: [{ "name": "...", "subjectId": "...", ... }]\n2. 对象: { "knowledgePoints": [...] }`}
              rows={10}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-primary transition-colors resize-none"
            />
            <button
              onClick={handlePasteSubmit}
              className="w-full bg-gray-100 text-text-primary font-medium py-2.5 rounded-xl text-sm hover:bg-gray-200 transition-colors"
            >
              解析 JSON
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className={`rounded-xl p-4 ${
            (importResult.successKP > 0 || importResult.successQ > 0) ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {(importResult.successKP > 0 || importResult.successQ > 0) ? (
                <CheckCircle size={20} className="text-green-500" />
              ) : (
                <AlertCircle size={20} className="text-amber-500" />
              )}
              <span className="font-medium text-sm">
                {(importResult.successKP > 0 || importResult.successQ > 0) ? '导入完成' : '导入结果'}
              </span>
            </div>

            {/* Knowledge Points Summary */}
            <div className="mb-3">
              <p className="text-xs font-medium text-text-secondary mb-2">知识点导入结果</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white rounded-lg p-2">
                  <p className="text-lg font-bold text-gray-700">{importResult.totalKP}</p>
                  <p className="text-[10px] text-text-muted">总数量</p>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <p className="text-lg font-bold text-green-600">{importResult.successKP}</p>
                  <p className="text-[10px] text-text-muted">成功</p>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <p className="text-lg font-bold text-amber-600">{importResult.duplicateKP}</p>
                  <p className="text-[10px] text-text-muted">重复</p>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <p className="text-lg font-bold text-red-600">{importResult.invalidKP}</p>
                  <p className="text-[10px] text-text-muted">无效</p>
                </div>
              </div>
            </div>

            {/* Questions Summary */}
            {importResult.totalQ > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-text-secondary mb-2">题目导入结果</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-lg font-bold text-gray-700">{importResult.totalQ}</p>
                    <p className="text-[10px] text-text-muted">总数量</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-lg font-bold text-green-600">{importResult.successQ}</p>
                    <p className="text-[10px] text-text-muted">成功</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-lg font-bold text-amber-600">{importResult.duplicateQ}</p>
                    <p className="text-[10px] text-text-muted">重复</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-lg font-bold text-red-600">{importResult.invalidQ}</p>
                    <p className="text-[10px] text-text-muted">无效</p>
                  </div>
                </div>
              </div>
            )}

            {(importResult.successKP > 0 || importResult.successQ > 0) && (
              <button
                onClick={() => navigate('knowledge')}
                className="w-full mt-3 bg-primary text-white font-medium py-2.5 rounded-xl text-sm"
              >
                查看知识库
              </button>
            )}
          </div>
        )}

        {/* Data Preview */}
        {parsedData.length > 0 && !importResult && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">数据预览</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">
                  知识点: {validItems.length}/{parsedData.length} 有效
                  {parsedQuestions.length > 0 && ` | 题目: ${parsedQuestions.length} 个`}
                </span>
                <button
                  onClick={handleClear}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
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
                    className={`rounded-xl border overflow-hidden ${
                      !isValid 
                        ? 'border-red-200 bg-red-50/50'
                        : isDuplicate
                          ? 'border-amber-200 bg-amber-50/50'
                          : 'border-gray-200 bg-white'
                    }`}
                  >
                    <button
                      onClick={() => toggleExpand(index)}
                      className="w-full p-3 flex items-center justify-between text-left"
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="flex items-center gap-2">
                          {!isValid ? (
                            <AlertCircle size={14} className="text-red-500 shrink-0" />
                          ) : isDuplicate ? (
                            <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded shrink-0">重复</span>
                          ) : (
                            <CheckCircle size={14} className="text-green-500 shrink-0" />
                          )}
                          <span className="text-sm font-medium truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-text-muted">
                            {state.subjects.find(s => s.id === item.subjectId)?.name || item.subjectId}
                          </span>
                          {!isValid && (
                            <span className="text-[10px] text-red-500">{validation.error}</span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-text-muted shrink-0" />
                      ) : (
                        <ChevronDown size={16} className="text-text-muted shrink-0" />
                      )}
                    </button>
                    
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-gray-100 pt-2">
                        <p className="text-xs text-text-muted mb-1">解释：</p>
                        <p className="text-xs text-text-secondary leading-relaxed">
                          {item.explanation || item.raw_text || '(无)'}
                        </p>
                        {item.keywords && item.keywords.length > 0 && (
                          <>
                            <p className="text-xs text-text-muted mb-1 mt-2">关键词：</p>
                            <div className="flex flex-wrap gap-1">
                              {item.keywords.map((kw, i) => (
                                <span key={i} className="text-[10px] bg-gray-100 text-text-secondary px-1.5 py-0.5 rounded">
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
                <div className="text-center py-2 text-xs text-text-muted">
                  还有 {parsedData.length - 50} 项未显示...
                </div>
              )}
            </div>

            {/* Import Button */}
            {validItems.length > 0 && (
              <button
                onClick={handleImport}
                className="w-full bg-primary text-white font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                导入 {validItems.length} 个知识点
                {parsedQuestions.length > 0 && ` + ${parsedQuestions.length} 个题目`}
              </button>
            )}
          </div>
        )}

        {/* Available Subjects Reference */}
        {parsedData.length === 0 && (
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="text-xs font-medium text-text-secondary mb-2">可用学科参考</h4>
            <div className="flex flex-wrap gap-2">
              {state.subjects.map(s => (
                <span key={s.id} className="text-xs bg-white px-2 py-1 rounded-lg border border-gray-200">
                  {s.icon} {s.id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Help Text */}
        {parsedData.length === 0 && (
          <div className="text-xs text-text-muted space-y-2">
            <p className="font-medium text-text-secondary">导入格式说明：</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>支持包含 <code className="bg-gray-100 px-1 rounded">knowledgePoints</code> 和 <code className="bg-gray-100 px-1 rounded">questions</code> 的对象</li>
              <li>每个知识点需包含 <code className="bg-gray-100 px-1 rounded">name</code>（名称）和 <code className="bg-gray-100 px-1 rounded">subjectId</code>（学科ID）</li>
              <li>题目需包含 <code className="bg-gray-100 px-1 rounded">stem</code>、<code className="bg-gray-100 px-1 rounded">options</code>、<code className="bg-gray-100 px-1 rounded">correctAnswers</code></li>
              <li>重复的知识点名称和题目ID会自动跳过</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
