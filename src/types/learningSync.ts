import type {
  Chapter,
  KnowledgePointExtended,
  Question,
  QuestionExplanation,
  QuizResult,
  Subject,
  WrongRecord,
} from '@/types';
import type { ImportHistoryEntry } from '@/store/LearningContext';

export interface LearningProgressRecord extends Partial<KnowledgePointExtended> {
  id: string;
  knowledgePointId: string;
  ownerUserId?: string;
  sourceType?: 'manual' | 'local-import' | 'cloud-import';
  quizSessions?: Array<Pick<QuizResult, 'id' | 'totalQuestions' | 'completedAt'>>;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface LearningBootstrapPayload {
  subjects: Subject[];
  chapters: Chapter[];
  knowledgePoints: KnowledgePointExtended[];
  questions: Question[];
  progress: LearningProgressRecord[];
  wrongRecords: WrongRecord[];
  questionExplanations: QuestionExplanation[];
  importHistory: ImportHistoryEntry[];
  version: string | null;
}

export interface LearningImportBatchPayload {
  importId?: string;
  sourceType?: 'manual' | 'local-import' | 'cloud-import';
  label?: string;
  subjects?: Subject[];
  chapters?: Chapter[];
  knowledgePoints?: KnowledgePointExtended[];
  questions?: Question[];
  importHistory?: ImportHistoryEntry[];
}

export interface LearningProgressPatch {
  progress?: LearningProgressRecord[];
  wrongRecords?: WrongRecord[];
  questionExplanations?: QuestionExplanation[];
  importHistory?: ImportHistoryEntry[];
}

export interface LearningDeletePayload {
  records?: Partial<Record<'subjects' | 'chapters' | 'knowledgePoints' | 'questions' | 'progress' | 'wrongRecords' | 'questionExplanations' | 'importHistory', string[]>>;
  importId?: string;
  deletedAt?: string;
}
