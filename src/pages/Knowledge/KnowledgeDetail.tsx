import { useState, useMemo } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { ProficiencyBadge, PageHeader } from '@/components/ui/Common';
import { PROFICIENCY_MAP } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { formatDate } from '@/utils/review';
import { Clock, RotateCcw, BookOpen, Sparkles, Edit3, Download, Copy, Check } from 'lucide-react';

export default function KnowledgeDetailPage() {
  const { userState, navigate } = useUser();
  const { learningState, learningDispatch } = useLearning();
  const { theme } = useTheme();
  const kpId = userState.pageParams.id;
  const kp = learningState.knowledgePoints.find(k => k.id === kpId);
  const subject = learningState.subjects.find(s => s.id === kp?.subjectId);
  const chapter = learningState.chapters.find(c => c.id === kp?.chapterId);

  // 获取关联题目：优先找知识点直接关联的，如果没有则找同一章节的题目
  const directQuestions = learningState.questions.filter(q => q.knowledgePointId === kpId);
  const chapterQuestions = chapter
    ? learningState.questions.filter(q => !q.knowledgePointId && q.chapterId === chapter.id)
    : [];
  const relatedQuestions = directQuestions.length > 0 ? directQuestions : chapterQuestions;
  const isUsingChapterQuestions = directQuestions.length === 0 && chapterQuestions.length > 0;
  const [copied, setCopied] = useState(false);

  // 来源配置 - 使用主题适配的颜色
  const sourceConfig = {
    ai: { icon: Sparkles, label: 'AI生成', color: 'text-purple-500', bgColor: 'rgba(168, 85, 247, 0.15)' },
    manual: { icon: Edit3, label: '手动添加', color: 'text-blue-500', bgColor: 'rgba(59, 130, 246, 0.15)' },
    import: { icon: Download, label: '导入', color: 'text-green-500', bgColor: 'rgba(34, 197, 94, 0.15)' },
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
    learningDispatch({ type: 'UPDATE_PROFICIENCY', payload: { id: kp.id, proficiency: level } });
  };

  const handleCopyWord = () => {
    navigator.clipboard.writeText(kp.name).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const SourceIcon = source.icon;

  // 建立所有知识点名称 -> id 映射表（用于跨知识库链接）
  const knowledgeNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    learningState.knowledgePoints.forEach(kp => {
      map[kp.name] = kp.id;
    });
    return map;
  }, [learningState.knowledgePoints]);

  // 将文本中的知识点名称转换为可点击链接
  const parseTextWithLinks = (text: string) => {
    const names = Object.keys(knowledgeNameMap).sort((a, b) => b.length - a.length);
    // 按长度降序排序，优先匹配长名称（避免"桂枝"被"桂枝汤"截断）

    if (names.length === 0) return [<>{text}</>];

    // 逐个转义特殊字符
    const escapedNames = names.map(name => {
      return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    const pattern = '(' + escapedNames.join('|') + ')';
    const regex = new RegExp(pattern, 'g');
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      if (knowledgeNameMap[part]) {
        const id = knowledgeNameMap[part];
        return (
          <button
            key={idx}
            onClick={() => navigate('knowledge-detail', { id })}
            className="text-primary underline underline-offset-2 decoration-primary/30 hover:decoration-primary/80 transition-all font-medium"
          >
            {part}
          </button>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  // 解析explanation中的内容
  const explanationLines = kp.explanation.split('\n').filter(l => l.trim());

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="知识点详情" onBack={() => navigate('knowledge')} />

      {/* Header Card */}
      <div className="px-4 pt-4">
        <div className="rounded-2xl p-5 border shadow-sm" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          {/* 单词展示 */}
          <div className="text-center mb-4">
            <h2 className="text-3xl font-bold mb-2">{kp.name}</h2>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={handleCopyWord}
                className="p-2 rounded-full transition-colors"
                style={{ backgroundColor: theme.border }}
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-text-muted" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="truncate">{subject?.icon} {subject?.name}</span>
              <span className="text-text-muted shrink-0">·</span>
              <span className="truncate">{chapter?.name}</span>
            </div>
            <ProficiencyBadge level={kp.proficiency} />
          </div>

          {/* 来源标记 */}
          <div className="flex items-center justify-between">
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${source.color}`} style={{ backgroundColor: source.bgColor }}>
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

        <div className="rounded-2xl p-4 border shadow-sm" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          {/* 逐行展示解释 */}
          <div className="space-y-3">
            {explanationLines.map((line, index) => {
              const trimmed = line.trim();
              const parsed = parseTextWithLinks(trimmed);

              // 检测句子（以句号、问号、感叹号结尾）
              if (/[。？！.?!]$/.test(trimmed)) {
                return (
                  <p key={index} className="text-sm text-text-secondary leading-relaxed">
                    {parsed}
                  </p>
                );
              }

              // 检测要点（以冒号结尾或短句）
              if (/[：:]$/.test(trimmed) || trimmed.length < 30) {
                return (
                  <div key={index} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <p className="text-sm text-text-secondary">{parsed}</p>
                  </div>
                );
              }

              // 其他内容
              return (
                <p key={index} className="text-sm text-text-secondary leading-relaxed">
                  {parsed}
                </p>
              );
            })}
          </div>
        </div>
      </div>

      {/* 记忆技巧提示 */}
      <div className="px-4 mt-4">
        <h3 className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>记忆提示</h3>
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)' }}>
              <span className="text-lg">💡</span>
            </div>
            <div className="text-sm" style={{ color: '#92400e' }}>
              <p className="font-medium mb-1">联想记忆法</p>
              <p className="text-xs" style={{ color: '#a16207' }}>尝试将 "{kp.name}" 与你熟悉的事物联系起来，形成生动的画面感，有助于长期记忆。</p>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Proficiency Update */}
      <div className="px-4 mt-4">
        <h3 className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>标记熟练度</h3>
        <div className="grid grid-cols-4 gap-2">
          {(['none', 'rusty', 'normal', 'master'] as ProficiencyLevel[]).map(level => {
            const config = PROFICIENCY_MAP[level];
            const isActive = kp.proficiency === level;
            return (
              <button
                key={level}
                onClick={() => handleSetProficiency(level)}
                className={`rounded-xl p-2.5 text-center border-2 transition-all ${isActive ? 'shadow-md scale-105' : 'border-transparent'
                  }`}
                style={isActive ? { borderColor: config.color, backgroundColor: config.bgColor } : { backgroundColor: theme.border }}
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
        <h3 className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>
          {isUsingChapterQuestions ? `章节练习题 (来自「${chapter?.name}」)` : `关联练习题`} ({relatedQuestions.length})
        </h3>
        {relatedQuestions.length > 0 ? (
          <div className="space-y-2">
            {relatedQuestions.map((q, i) => (
              <div key={q.id} className="rounded-xl p-4 border shadow-sm" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}>
                    题目 {i + 1}
                  </span>
                  <span className="text-xs" style={{ color: theme.textMuted }}>
                    {q.type === 'single_choice' ? '单选题' : '多选题'}
                  </span>
                </div>
                <p className="text-sm mb-3" style={{ color: theme.textPrimary }}>{q.stem}</p>
                <div className="space-y-1.5">
                  {q.options.map((opt, optIdx) => {
                    const label = String.fromCharCode(65 + optIdx);
                    const hasPrefix = /^[A-G]\.\s/.test(opt.text);
                    const isCorrect = q.correctAnswers.includes(opt.id);
                    return (
                      <div
                        key={opt.id}
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          backgroundColor: isCorrect ? 'rgba(34, 197, 94, 0.15)' : theme.border,
                          color: isCorrect ? '#15803d' : theme.textMuted
                        }}
                      >
                        {hasPrefix ? opt.text : `${label}. ${opt.text}`}
                        {isCorrect && ' ✓'}
                      </div>
                    );
                  })}
                </div>
                {q.explanation && (
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
                    <p className="text-xs" style={{ color: theme.textMuted }}>解析：{q.explanation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: theme.border }}>
            <p className="text-sm" style={{ color: theme.textMuted }}>暂无关联练习题</p>
            <button
              onClick={() => navigate('quiz-session', { subjectId: kp.subjectId })}
              className="mt-2 text-xs underline"
              style={{ color: theme.primary }}
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
          className="w-full font-medium py-3 rounded-xl text-sm shadow-md active:opacity-80 transition-opacity"
          style={{ backgroundColor: theme.primary, color: '#ffffff' }}
        >
          开始练习此知识点
        </button>
        <button
          onClick={() => navigate('knowledge')}
          className="w-full font-medium py-2.5 rounded-xl text-sm"
          style={{ backgroundColor: theme.border, color: theme.textSecondary }}
        >
          返回知识库
        </button>
      </div>
    </div>
  );
}
