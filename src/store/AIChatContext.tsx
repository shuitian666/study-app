/**
 * ============================================================================
 * AI聊天状态管理 - AIChatContext
 * ============================================================================
 * 
 * 包含AI聊天会话、消息和生成的问题等状态
 * ============================================================================
 */

import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type {
  ChatMessage, AIChatSession, Question
} from '@/types';

// ---------- State ----------
export interface AIChatState {
  aiChat: AIChatSession;
}

const initialAIChatState: AIChatState = {
  aiChat: { messages: [], isLoading: false, generatedQuestions: [] },
};

// ---------- Actions ----------
type AIChatAction =
  | { type: 'AI_SEND_MESSAGE'; payload: ChatMessage }
  | { type: 'AI_RECEIVE_MESSAGE'; payload: ChatMessage }
  | { type: 'AI_SET_LOADING'; payload: boolean }
  | { type: 'AI_ADD_GENERATED_QUESTION'; payload: Question }
  | { type: 'AI_CLEAR_CHAT' }
  | { type: 'AI_UPDATE_STREAMING_MESSAGE'; payload: { id: string; content: string } };

function aiChatReducer(state: AIChatState, action: AIChatAction): AIChatState {
  switch (action.type) {
    case 'AI_SEND_MESSAGE':
      return {
        ...state,
        aiChat: {
          ...state.aiChat,
          messages: [...state.aiChat.messages, action.payload],
          isLoading: true,
        },
      };
    case 'AI_RECEIVE_MESSAGE':
      return {
        ...state,
        aiChat: {
          ...state.aiChat,
          messages: [...state.aiChat.messages, action.payload],
          isLoading: false,
        },
      };
    case 'AI_SET_LOADING':
      return {
        ...state,
        aiChat: { ...state.aiChat, isLoading: action.payload },
      };
    case 'AI_ADD_GENERATED_QUESTION':
      return {
        ...state,
        aiChat: {
          ...state.aiChat,
          generatedQuestions: [...state.aiChat.generatedQuestions, action.payload.id],
        },
      };
    case 'AI_CLEAR_CHAT':
      return {
        ...state,
        aiChat: { messages: [], isLoading: false, generatedQuestions: [] },
      };
    case 'AI_UPDATE_STREAMING_MESSAGE':
      return {
        ...state,
        aiChat: {
          ...state.aiChat,
          messages: state.aiChat.messages.map(m =>
            m.id === action.payload.id ? { ...m, content: action.payload.content } : m
          ),
        },
      };
    default:
      return state;
  }
}

// ---------- Context ----------
interface AIChatContextType {
  aiChatState: AIChatState;
  aiChatDispatch: React.Dispatch<AIChatAction>;
}

const AIChatContext = createContext<AIChatContextType | null>(null);

export function AIChatProvider({ children }: { children: ReactNode }) {
  const [aiChatState, aiChatDispatch] = useReducer(aiChatReducer, initialAIChatState);

  return (
    <AIChatContext.Provider value={{ aiChatState, aiChatDispatch }}>
      {children}
    </AIChatContext.Provider>
  );
}

export function useAIChat() {
  const ctx = useContext(AIChatContext);
  if (!ctx) throw new Error('useAIChat must be used within AIChatProvider');
  return ctx;
}
