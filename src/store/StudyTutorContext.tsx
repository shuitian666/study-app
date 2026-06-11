import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { AIStudyTutorMessage } from '@/types';

interface StudyTutorThread {
  messages: AIStudyTutorMessage[];
  isLoading: boolean;
}

interface StudyTutorState {
  threads: Record<string, StudyTutorThread>;
}

type StudyTutorAction =
  | { type: 'ADD_MESSAGE'; payload: { threadId: string; message: AIStudyTutorMessage } }
  | { type: 'UPDATE_MESSAGE'; payload: { threadId: string; messageId: string; content: string } }
  | { type: 'SET_LOADING'; payload: { threadId: string; isLoading: boolean } }
  | { type: 'CLEAR_THREAD'; payload: string };

const EMPTY_THREAD: StudyTutorThread = { messages: [], isLoading: false };
const StudyTutorContext = createContext<{
  state: StudyTutorState;
  dispatch: React.Dispatch<StudyTutorAction>;
} | null>(null);

function reducer(state: StudyTutorState, action: StudyTutorAction): StudyTutorState {
  if (action.type === 'CLEAR_THREAD') {
    const threads = { ...state.threads };
    delete threads[action.payload];
    return { threads };
  }

  const threadId = action.payload.threadId;
  const thread = state.threads[threadId] || EMPTY_THREAD;
  if (action.type === 'ADD_MESSAGE') {
    return {
      threads: {
        ...state.threads,
        [threadId]: { ...thread, messages: [...thread.messages, action.payload.message] },
      },
    };
  }
  if (action.type === 'UPDATE_MESSAGE') {
    return {
      threads: {
        ...state.threads,
        [threadId]: {
          ...thread,
          messages: thread.messages.map(message =>
            message.id === action.payload.messageId
              ? { ...message, content: action.payload.content }
              : message
          ),
        },
      },
    };
  }
  return {
    threads: {
      ...state.threads,
      [threadId]: { ...thread, isLoading: action.payload.isLoading },
    },
  };
}

export function StudyTutorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { threads: {} });
  return (
    <StudyTutorContext.Provider value={{ state, dispatch }}>
      {children}
    </StudyTutorContext.Provider>
  );
}

export function useStudyTutor() {
  const value = useContext(StudyTutorContext);
  if (!value) throw new Error('useStudyTutor must be used within StudyTutorProvider');
  return value;
}
