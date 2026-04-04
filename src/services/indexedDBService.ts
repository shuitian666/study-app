/**
 * ============================================================================
 * IndexedDB 存储服务
 * ============================================================================
 * 
 * 用于存储大型知识库数据，替代 localStorage 的容量限制
 * ============================================================================
 */

const DB_NAME = 'study-app-db';
const DB_VERSION = 1;
const STORES = {
  KNOWLEDGE_POINTS: 'knowledgePoints',
  QUESTIONS: 'questions',
  SUBJECTS: 'subjects',
  CHAPTERS: 'chapters',
};

// 打开数据库连接
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 创建存储对象
      if (!db.objectStoreNames.contains(STORES.KNOWLEDGE_POINTS)) {
        db.createObjectStore(STORES.KNOWLEDGE_POINTS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.QUESTIONS)) {
        db.createObjectStore(STORES.QUESTIONS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.SUBJECTS)) {
        db.createObjectStore(STORES.SUBJECTS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.CHAPTERS)) {
        db.createObjectStore(STORES.CHAPTERS, { keyPath: 'id' });
      }
    };
  });
}

// 存储数据到指定存储对象
async function storeData<T>(storeName: string, data: T[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    // 清空现有数据
    const clearRequest = store.clear();
    clearRequest.onerror = () => reject(clearRequest.error);

    clearRequest.onsuccess = () => {
      // 批量添加数据
      let count = 0;
      data.forEach(item => {
        const request = store.add(item);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          count++;
          if (count === data.length) {
            resolve();
          }
        };
      });
    };

    transaction.onerror = () => reject(transaction.error);
  });
}

// 从指定存储对象读取所有数据
async function getData<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// 检查存储对象是否有数据
async function hasData(storeName: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.count();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result > 0);
  });
}

// 存储知识库数据
export async function storeKnowledgeData(data: {
  subjects: any[];
  chapters: any[];
  knowledgePoints: any[];
  questions: any[];
}): Promise<void> {
  await storeData(STORES.SUBJECTS, data.subjects);
  await storeData(STORES.CHAPTERS, data.chapters);
  await storeData(STORES.KNOWLEDGE_POINTS, data.knowledgePoints);
  await storeData(STORES.QUESTIONS, data.questions);
}

// 读取知识库数据
export async function getKnowledgeData(): Promise<{
  subjects: any[];
  chapters: any[];
  knowledgePoints: any[];
  questions: any[];
}> {
  const subjects = await getData(STORES.SUBJECTS);
  const chapters = await getData(STORES.CHAPTERS);
  const knowledgePoints = await getData(STORES.KNOWLEDGE_POINTS);
  const questions = await getData(STORES.QUESTIONS);

  return { subjects, chapters, knowledgePoints, questions };
}

// 检查是否有存储的知识库数据
export async function hasKnowledgeData(): Promise<boolean> {
  const hasSubjects = await hasData(STORES.SUBJECTS);
  const hasChapters = await hasData(STORES.CHAPTERS);
  const hasKnowledgePoints = await hasData(STORES.KNOWLEDGE_POINTS);
  const hasQuestions = await hasData(STORES.QUESTIONS);

  return hasSubjects && hasChapters && hasKnowledgePoints && hasQuestions;
}

// 清除所有知识库数据
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
