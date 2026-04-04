import { useState, useEffect } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { PageHeader } from '@/components/ui/Common';
import type { ProficiencyLevel } from '@/types';
import { PROFICIENCY_MAP } from '@/types';
import { Undo2 } from 'lucide-react';

export default function AddKnowledgePage() {
  const { navigate } = useUser();
  const { learningState, learningDispatch, undo, _canUndo } = useLearning();
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
  const [name, setName] = useState('');
  const [explanation, setExplanation] = useState('');
  const [subjectId, setSubjectId] = useState(learningState.subjects[0]?.id ?? '');
  const [chapterId, setChapterId] = useState('');
  const [proficiency, setProficiency] = useState<ProficiencyLevel>('none');

  const chapters = learningState.chapters.filter(c => c.subjectId === subjectId);

  const handleSubmit = () => {
    if (!name.trim() || !subjectId) return;
    const newKP = {
      id: `kp-${Date.now()}`,
      subjectId,
      chapterId: chapterId || chapters[0]?.id || '',
      name: name.trim(),
      explanation: explanation.trim(),
      proficiency,
      source: 'manual' as const,
      lastReviewedAt: null,
      nextReviewAt: new Date().toISOString(),
      reviewCount: 0,
      createdAt: new Date().toISOString(),
    };
    learningDispatch({ type: 'ADD_KNOWLEDGE_POINT', payload: newKP });
    navigate('knowledge');
  };

  return (
    <div className="page-scroll pb-4">
      <PageHeader 
        title="添加知识点" 
        onBack={() => navigate('knowledge')} 
        rightAction={
          <button
            onClick={undo}
            disabled={!_canUndo}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: theme.border }}
            title="撤销"
          >
            <Undo2 size={18} style={{ color: theme.textSecondary }} />
          </button>
        }
      />

      <div className={`px-4 pt-4 space-y-4 ${getAnimationClass(1)}`}>
        {/* Subject select */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.textSecondary }}>学科</label>
          <div className="flex gap-2 flex-wrap">
            {learningState.subjects.map(s => (
              <button
                key={s.id}
                onClick={() => { setSubjectId(s.id); setChapterId(''); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  subjectId === s.id ? 'text-white' : ''
                }`}
                style={{
                  backgroundColor: subjectId === s.id ? theme.primary : theme.border,
                  color: subjectId === s.id ? '#ffffff' : theme.textSecondary
                }}
              >
                {s.icon} {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Chapter select */}
        {chapters.length > 0 && (
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.textSecondary }}>章节</label>
            <div className="flex gap-2 flex-wrap">
              {chapters.map(c => (
                <button
                  key={c.id}
                  onClick={() => setChapterId(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    chapterId === c.id ? 'text-white' : ''
                  }`}
                  style={{
                    backgroundColor: chapterId === c.id ? theme.primary : theme.border,
                    color: chapterId === c.id ? '#ffffff' : theme.textSecondary
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Knowledge name */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.textSecondary }}>知识点名称</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如：三角函数的基本性质"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            style={{ 
              backgroundColor: theme.bgCard, 
              border: `1px solid ${theme.border}`,
              color: theme.textPrimary
            }}
          />
        </div>

        {/* Explanation */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.textSecondary }}>知识点讲解</label>
          <textarea
            value={explanation}
            onChange={e => setExplanation(e.target.value)}
            placeholder="详细解释这个知识点的含义..."
            rows={4}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors resize-none"
            style={{ 
              backgroundColor: theme.bgCard, 
              border: `1px solid ${theme.border}`,
              color: theme.textPrimary
            }}
          />
        </div>

        {/* Proficiency select */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.textSecondary }}>当前掌握程度</label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(PROFICIENCY_MAP) as ProficiencyLevel[]).map(level => (
              <button
                key={level}
                onClick={() => setProficiency(level)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors`}
                style={{
                  backgroundColor: proficiency === level ? PROFICIENCY_MAP[level].color : theme.border,
                  color: proficiency === level ? '#ffffff' : theme.textSecondary
                }}
              >
                {PROFICIENCY_MAP[level].label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !subjectId}
          className="w-full font-medium py-3 rounded-xl text-sm disabled:opacity-50 active:opacity-80 transition-opacity"
          style={{ backgroundColor: theme.primary, color: '#ffffff' }}
        >
          添加知识点
        </button>
      </div>
    </div>
  );
}
