import type { KnowledgeSubject } from '@/services/ossService';

export type StudyDirection = 'medical' | 'pharmacy' | 'nursing' | 'english';

export const STUDY_DIRECTIONS: Array<{
  id: StudyDirection;
  label: string;
  description: string;
  packageIds: string[];
}> = [
  {
    id: 'medical',
    label: '医考',
    description: '微生物、免疫与基础医学复习',
    packageIds: ['micro', 'immuno'],
  },
  {
    id: 'pharmacy',
    label: '药考',
    description: '分析化学与仪器分析',
    packageIds: ['analytical', 'instrumental_analysis'],
  },
  {
    id: 'nursing',
    label: '护考',
    description: '先从微生物与免疫基础开始',
    packageIds: ['micro', 'immuno'],
  },
  {
    id: 'english',
    label: '英语词汇',
    description: '考研/六级词汇与搭配',
    packageIds: ['english_vocabulary'],
  },
];

export function getRecommendedPackages(
  subjects: KnowledgeSubject[],
  direction: StudyDirection,
): KnowledgeSubject[] {
  const directionConfig = STUDY_DIRECTIONS.find(item => item.id === direction) ?? STUDY_DIRECTIONS[0];
  const byId = new Map(subjects.map(subject => [subject.id, subject]));
  return directionConfig.packageIds
    .map(id => byId.get(id))
    .filter((subject): subject is KnowledgeSubject => Boolean(subject));
}

export function getDefaultDirectionForSubject(subjectId?: string): StudyDirection {
  if (subjectId === 'english_vocabulary') return 'english';
  if (subjectId === 'analytical' || subjectId === 'instrumental_analysis') return 'pharmacy';
  return 'medical';
}
