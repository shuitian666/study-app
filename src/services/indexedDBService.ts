import type { AIStudySession, Chapter, KnowledgePoint, Question, Subject } from '@/types';

const DB_NAME = 'study-app-db';
const DB_VERSION = 2;
const STORES = {
  KNOWLEDGE_POINTS: 'knowledgePoints',
  QUESTIONS: 'questions',
  SUBJECTS: 'subjects',
  CHAPTERS: 'chapters',
  AI_STUDY_SESSIONS: 'aiStudySessions',
} as const;

type KnowledgeStoreName = Exclude<typeof STORES[keyof typeof STORES], typeof STORES.AI_STUDY_SESSIONS>;
type StoredRecord = { id: string };
type StoredAIStudySession = AIStudySession & { storageKey: string };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      [
        STORES.KNOWLEDGE_POINTS,
        STORES.QUESTIONS,
        STORES.SUBJECTS,
        STORES.CHAPTERS,
      ].forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });

      if (!db.objectStoreNames.contains(STORES.AI_STUDY_SESSIONS)) {
        const sessionStore = db.createObjectStore(STORES.AI_STUDY_SESSIONS, { keyPath: 'storageKey' });
        sessionStore.createIndex('ownerUserId', 'ownerUserId', { unique: false });
      }
    };
  });
}

async function storeData<T extends StoredRecord>(storeName: KnowledgeStoreName, data: T[]): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const nextIds = new Set(data.map(item => item.id));
    let settled = false;

    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const keysRequest = store.getAllKeys();
    keysRequest.onerror = () => rejectOnce(keysRequest.error);
    keysRequest.onsuccess = () => {
      keysRequest.result.forEach(key => {
        if (typeof key === 'string' && !nextIds.has(key)) {
          store.delete(key).onerror = event => rejectOnce((event.target as IDBRequest).error);
        }
      });

      data.forEach(item => {
        store.put(item).onerror = event => rejectOnce((event.target as IDBRequest).error);
      });
    };

    transaction.oncomplete = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    transaction.onerror = () => rejectOnce(transaction.error);
    transaction.onabort = () => rejectOnce(transaction.error || new Error(`IndexedDB transaction aborted: ${storeName}`));
  });
}

async function getData<T>(storeName: KnowledgeStoreName): Promise<T[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function hasData(storeName: KnowledgeStoreName): Promise<boolean> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.count();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result > 0);
  });
}

export async function storeKnowledgeData(data: {
  subjects: Subject[];
  chapters: Chapter[];
  knowledgePoints: KnowledgePoint[];
  questions: Question[];
}): Promise<void> {
  await storeData(STORES.SUBJECTS, data.subjects);
  await storeData(STORES.CHAPTERS, data.chapters);
  await storeData(STORES.KNOWLEDGE_POINTS, data.knowledgePoints);
  await storeData(STORES.QUESTIONS, data.questions);
}

export async function getKnowledgeData(): Promise<{
  subjects: Subject[];
  chapters: Chapter[];
  knowledgePoints: KnowledgePoint[];
  questions: Question[];
}> {
  const subjects = await getData<Subject>(STORES.SUBJECTS);
  const chapters = await getData<Chapter>(STORES.CHAPTERS);
  const knowledgePoints = await getData<KnowledgePoint>(STORES.KNOWLEDGE_POINTS);
  const questions = await getData<Question>(STORES.QUESTIONS);

  return { subjects, chapters, knowledgePoints, questions };
}

export async function hasKnowledgeData(): Promise<boolean> {
  const hasSubjects = await hasData(STORES.SUBJECTS);
  const hasChapters = await hasData(STORES.CHAPTERS);
  const hasKnowledgePoints = await hasData(STORES.KNOWLEDGE_POINTS);
  const hasQuestions = await hasData(STORES.QUESTIONS);

  return hasSubjects && hasChapters && hasKnowledgePoints && hasQuestions;
}

export async function saveAIStudySession(session: AIStudySession): Promise<void> {
  const db = await openDB();
  const record: StoredAIStudySession = {
    ...session,
    storageKey: `${session.ownerUserId}:${session.id}`,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.AI_STUDY_SESSIONS, 'readwrite');
    transaction.objectStore(STORES.AI_STUDY_SESSIONS).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('AI study session save aborted'));
  });
}

export async function getAIStudySessions(ownerUserId: string): Promise<AIStudySession[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.AI_STUDY_SESSIONS, 'readonly');
    const index = transaction.objectStore(STORES.AI_STUDY_SESSIONS).index('ownerUserId');
    const request = index.getAll(ownerUserId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const sessions = (request.result as StoredAIStudySession[])
        .map(record => {
          const session = { ...record };
          delete (session as Partial<StoredAIStudySession>).storageKey;
          return session as AIStudySession;
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      resolve(sessions);
    };
  });
}

export async function deleteAIStudySession(ownerUserId: string, sessionId: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.AI_STUDY_SESSIONS, 'readwrite');
    transaction.objectStore(STORES.AI_STUDY_SESSIONS).delete(`${ownerUserId}:${sessionId}`);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('AI study session delete aborted'));
  });
}

export async function clearKnowledgeData(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(Object.values(STORES), 'readwrite');

    Object.values(STORES).forEach(storeName => {
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onerror = () => reject(request.error);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
