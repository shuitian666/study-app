import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/ui/Common';
import type { ProficiencyLevel } from '@/types';
import { PROFICIENCY_MAP } from '@/types';
import { Undo2 } from 'lucide-react';

export default function AddKnowledgePage() {
  const { state, dispatch, navigate, undo, _canUndo } = useApp();
  const [name, setName] = useState('');
  const [explanation, setExplanation] = useState('');
  const [subjectId, setSubjectId] = useState(state.subjects[0]?.id ?? '');
  const [chapterId, setChapterId] = useState('');
  const [proficiency, setProficiency] = useState<ProficiencyLevel>('none');

  const chapters = state.chapters.filter(c => c.subjectId === subjectId);

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
    dispatch({ type: 'ADD_KNOWLEDGE_POINT', payload: newKP });
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
            className="p-1.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="撤销"
          >
            <Undo2 size={18} className="text-gray-600" />
          </button>
        }
      />

      <div className="px-4 pt-4 space-y-4">
        {/* Subject select */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">学科</label>
          <div className="flex gap-2 flex-wrap">
            {state.subjects.map(s => (
              <button
                key={s.id}
                onClick={() => { setSubjectId(s.id); setChapterId(''); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  subjectId === s.id ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'
                }`}
              >
                {s.icon} {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Chapter select */}
        {chapters.length > 0 && (
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">章节</label>
            <div className="flex gap-2 flex-wrap">
              {chapters.map(c => (
                <button
                  key={c.id}
                  onClick={() => setChapterId(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    chapterId === c.id ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Knowledge name */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">知识点名称</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如：三角函数的基本性质"
            className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Explanation */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">知识点讲解</label>
          <textarea
            value={explanation}
            onChange={e => setExplanation(e.target.value)}
            placeholder="详细解释这个知识点的含义..."
            rows={4}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors resize-none"
          />
        </div>

        {/* Proficiency select */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">当前掌握程度</label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(PROFICIENCY_MAP) as ProficiencyLevel[]).map(level => (
              <button
                key={level}
                onClick={() => setProficiency(level)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  proficiency === level
                    ? 'text-white'
                    : 'bg-gray-100 text-text-secondary'
                }`}
                style={{
                  backgroundColor: proficiency === level ? PROFICIENCY_MAP[level].color : undefined,
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
          className="w-full bg-primary text-white font-medium py-3 rounded-xl text-sm disabled:opacity-50 active:opacity-80 transition-opacity"
        >
          添加知识点
        </button>
      </div>
    </div>
  );
}
