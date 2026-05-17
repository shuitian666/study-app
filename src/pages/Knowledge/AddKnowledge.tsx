import { useEffect, useState } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { PageHeader } from '@/components/ui/Common';
import type { ProficiencyLevel } from '@/types';
import { PROFICIENCY_MAP } from '@/types';

export default function AddKnowledgePage() {
  const { navigate } = useUser();
  const { learningState, learningDispatch } = useLearning();
  const { theme } = useTheme();
  const [animationEffect, setAnimationEffect] = useState(() => {
    const saved = localStorage.getItem('sub-animation-effect');
    return saved || 'fade-in';
  });
  const [name, setName] = useState('');
  const [explanation, setExplanation] = useState('');
  const [subjectId, setSubjectId] = useState(learningState.subjects[0]?.id ?? '');
  const [chapterId, setChapterId] = useState('');
  const [proficiency, setProficiency] = useState<ProficiencyLevel>('none');

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'sub-animation-effect' && event.newValue) {
        setAnimationEffect(event.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const getAnimationClass = (delay: number) => {
    return `scroll-${animationEffect} reveal-delay-${delay}`;
  };

  const chapters = learningState.chapters.filter(chapter => chapter.subjectId === subjectId);

  const handleSubmit = () => {
    if (!name.trim() || !subjectId) return;
    const now = new Date().toISOString();
    const knowledgePointId = `kp-${now.replace(/\D/g, '')}`;

    learningDispatch({
      type: 'ADD_KNOWLEDGE_POINT',
      payload: {
        id: knowledgePointId,
        subjectId,
        chapterId: chapterId || chapters[0]?.id || '',
        name: name.trim(),
        explanation: explanation.trim(),
        proficiency,
        source: 'manual',
        lastReviewedAt: null,
        nextReviewAt: null,
        reviewCount: 0,
        createdAt: now,
        importHistory: {
          source: 'manual',
          label: name.trim(),
          createdAt: now,
        },
      },
    });
    navigate('knowledge');
  };

  return (
    <div className="page-scroll pb-4">
      <PageHeader
        title="添加知识点"
        onBack={() => navigate('knowledge')}
      />

      <div className={`px-4 pt-4 space-y-4 ${getAnimationClass(1)}`}>
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.textSecondary }}>学科</label>
          <div className="flex gap-2 flex-wrap">
            {learningState.subjects.map(subject => (
              <button
                key={subject.id}
                onClick={() => {
                  setSubjectId(subject.id);
                  setChapterId('');
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${subjectId === subject.id ? 'text-white' : ''}`}
                style={{
                  backgroundColor: subjectId === subject.id ? theme.primary : theme.border,
                  color: subjectId === subject.id ? '#ffffff' : theme.textSecondary,
                }}
              >
                {subject.icon} {subject.name}
              </button>
            ))}
          </div>
        </div>

        {chapters.length > 0 && (
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.textSecondary }}>章节</label>
            <div className="flex gap-2 flex-wrap">
              {chapters.map(chapter => (
                <button
                  key={chapter.id}
                  onClick={() => setChapterId(chapter.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${chapterId === chapter.id ? 'text-white' : ''}`}
                  style={{
                    backgroundColor: chapterId === chapter.id ? theme.primary : theme.border,
                    color: chapterId === chapter.id ? '#ffffff' : theme.textSecondary,
                  }}
                >
                  {chapter.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.textSecondary }}>知识点名称</label>
          <input
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="例如：三角函数的基本性质"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            style={{
              backgroundColor: theme.bgCard,
              border: `1px solid ${theme.border}`,
              color: theme.textPrimary,
            }}
          />
        </div>

        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.textSecondary }}>知识点讲解</label>
          <textarea
            value={explanation}
            onChange={event => setExplanation(event.target.value)}
            placeholder="详细解释这个知识点的含义..."
            rows={4}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors resize-none"
            style={{
              backgroundColor: theme.bgCard,
              border: `1px solid ${theme.border}`,
              color: theme.textPrimary,
            }}
          />
        </div>

        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: theme.textSecondary }}>当前掌握程度</label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(PROFICIENCY_MAP) as ProficiencyLevel[]).map(level => (
              <button
                key={level}
                onClick={() => setProficiency(level)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  backgroundColor: proficiency === level ? PROFICIENCY_MAP[level].color : theme.border,
                  color: proficiency === level ? '#ffffff' : theme.textSecondary,
                }}
              >
                {PROFICIENCY_MAP[level].label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !subjectId}
          className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: theme.primary }}
        >
          保存知识点
        </button>
      </div>
    </div>
  );
}
