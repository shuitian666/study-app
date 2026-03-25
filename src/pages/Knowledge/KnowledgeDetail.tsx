import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { ProficiencyBadge, PageHeader } from '@/components/ui/Common';
import { PROFICIENCY_MAP } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { formatDate } from '@/utils/review';
import { Clock, RotateCcw, BookOpen, Sparkles, Edit3, Download, Copy, Check } from 'lucide-react';

export default function KnowledgeDetailPage() {
  const { state, dispatch, navigate } = useApp();
  const kpId = state.pageParams.id;
  const kp = state.knowledgePoints.find(k => k.id === kpId);
  const subject = state.subjects.find(s => s.id === kp?.subjectId);
  const chapter = state.chapters.find(c => c.id === kp?.chapterId);
  const relatedQuestions = state.questions.filter(q => q.knowledgePointId === kpId);
  const [copied, setCopied] = useState(false);

  // 来源配置
  const sourceConfig = {
    ai: { icon: Sparkles, label: 'AI生成', color: 'text-purple-500', bgColor: 'bg-purple-50' },
    manual: { icon: Edit3, label: '手动添加', color: 'text-blue-500', bgColor: 'bg-blue-50' },
    import: { icon: Download, label: '导入', color: 'text-green-500', bgColor: 'bg-green-50' },
  };
  const source = sourceConfig[kp?.source || 'manual'];

  if (!kp) {
    return (
      <div>
        <PageHeader title="知识点" onBack={() => navigate('knowledge')} />
        <div className="p-8 text-center text-text-muted">知识点不存在</div>
      </div>
    );
  }

  const handleSetProficiency = (level: ProficiencyLevel) => {
    dispatch({ type: 'UPDATE_PROFICIENCY', payload: { id: kp.id, proficiency: level } });
  };

  const handleCopyWord = () => {
    navigator.clipboard.writeText(kp.name).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const SourceIcon = source.icon;

  // 解析explanation中的内容
  const explanationLines = kp.explanation.split('\n').filter(l => l.trim());

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="知识点详情" onBack={() => navigate('knowledge')} />

      {/* Header Card */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
          {/* 单词展示 */}
          <div className="text-center mb-4">
            <h2 className="text-3xl font-bold mb-2">{kp.name}</h2>
            <div className="flex items-center justify-center gap-2">
              <button 
                onClick={handleCopyWord}
                className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-text-muted" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span>{subject?.icon} {subject?.name}</span>
              <span className="text-text-muted">·</span>
              <span>{chapter?.name}</span>
            </div>
            <ProficiencyBadge level={kp.proficiency} />
          </div>

          {/* 来源标记 */}
          <div className="flex items-center justify-between">
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${source.color} ${source.bgColor}`}>
              <SourceIcon size={12} />
              <span>{source.label}</span>
            </div>

            <div className="flex items-center gap-4 text-xs text-text-muted">
              <div className="flex items-center gap-1">
                <RotateCcw size={12} />
                <span>复习 {kp.reviewCount} 次</span>
              </div>

              {kp.lastReviewedAt && (
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  <span>上次复习 {formatDate(kp.lastReviewedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 详细解释卡片 */}
      <div className="px-4 mt-4">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <BookOpen size={14} className="text-primary" />
          详细解释
        </h3>

        <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
          {/* 逐行展示解释 */}
          <div className="space-y-3">
            {explanationLines.map((line, index) => {
              const trimmed = line.trim();
              
              // 检测句子（以句号、问号、感叹号结尾）
              if (/[。？！.?!]$/.test(trimmed)) {
                return (
                  <p key={index} className="text-sm text-text-secondary leading-relaxed">
                    {trimmed}
                  </p>
                );
              }
              
              // 检测要点（以冒号结尾或短句）
              if (/[：:]$/.test(trimmed) || trimmed.length < 30) {
                return (
                  <div key={index} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <p className="text-sm text-text-secondary">{trimmed}</p>
                  </div>
                );
              }
              
              // 其他内容
              return (
                <p key={index} className="text-sm text-text-secondary leading-relaxed">
                  {trimmed}
                </p>
              );
            })}
          </div>
        </div>
      </div>

      {/* 记忆技巧提示 */}
      <div className="px-4 mt-4">
        <h3 className="text-sm font-semibold mb-2">记忆提示</h3>
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-lg">💡</span>
            </div>
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">联想记忆法</p>
              <p className="text-amber-700 text-xs">尝试将 "{kp.name}" 与你熟悉的事物联系起来，形成生动的画面感，有助于长期记忆。</p>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Proficiency Update */}
      <div className="px-4 mt-4">
        <h3 className="text-sm font-semibold mb-2">标记熟练度</h3>
        <div className="grid grid-cols-4 gap-2">
          {(['none', 'rusty', 'normal', 'master'] as ProficiencyLevel[]).map(level => {
            const config = PROFICIENCY_MAP[level];
            const isActive = kp.proficiency === level;
            return (
              <button
                key={level}
                onClick={() => handleSetProficiency(level)}
                className={`rounded-xl p-2.5 text-center border-2 transition-all ${
                  isActive ? 'shadow-md scale-105' : 'border-transparent bg-gray-50'
                }`}
                style={isActive ? { borderColor: config.color, backgroundColor: config.bgColor } : {}}
              >
                <div className="text-xs font-medium" style={{ color: config.color }}>
                  {config.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Related Questions */}
      <div className="px-4 mt-4 mb-4">
        <h3 className="text-sm font-semibold mb-2">关联练习题 ({relatedQuestions.length})</h3>
        {relatedQuestions.length > 0 ? (
          <div className="space-y-2">
            {relatedQuestions.map((q, i) => (
              <div key={q.id} className="bg-white rounded-xl p-4 border border-border shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    题目 {i + 1}
                  </span>
                  <span className="text-xs text-text-muted">
                    {q.type === 'single_choice' ? '单选题' : '多选题'}
                  </span>
                </div>
                <p className="text-sm mb-3">{q.stem}</p>
                <div className="space-y-1.5">
                  {q.options.map((opt, optIdx) => (
                    <div 
                      key={opt.id} 
                      className={`text-xs px-2 py-1 rounded ${
                        q.correctAnswers.includes(opt.id) 
                          ? 'bg-green-50 text-green-700' 
                          : 'bg-gray-50 text-text-muted'
                      }`}
                    >
                      {String.fromCharCode(65 + optIdx)}. {opt.text}
                      {q.correctAnswers.includes(opt.id) && ' ✓'}
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-text-muted">解析：{q.explanation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-sm text-text-muted">暂无关联练习题</p>
            <button
              onClick={() => navigate('quiz-session', { subjectId: kp.subjectId })}
              className="mt-2 text-xs text-primary underline"
            >
              去刷题获取更多练习
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-4 mb-4 space-y-2">
        <button
          onClick={() => navigate('quiz-session', { subjectId: kp.subjectId, knowledgePointId: kp.id })}
          className="w-full bg-primary text-white font-medium py-3 rounded-xl text-sm shadow-md active:opacity-80 transition-opacity"
        >
          开始练习此知识点
        </button>
        <button
          onClick={() => navigate('knowledge')}
          className="w-full bg-gray-100 text-text-secondary font-medium py-2.5 rounded-xl text-sm"
        >
          返回知识库
        </button>
      </div>
    </div>
  );
}
