import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * 流式文本消费 Hook
 * 消费 async generator 产出的文本片段，逐步累积到 streamingText
 * 优化：添加防抖，减少频繁重渲染
 */

export function useStreaming() {
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef(false);
  const updateTimerRef = useRef<number | null>(null);
  const pendingTextRef = useRef('');

  // 组件卸载时自动中止
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, []);

  const startStream = useCallback(async (
    generator: AsyncGenerator<string>,
    onChunk?: (accumulated: string) => void,
  ) => {
    abortRef.current = false;
    setStreamingText('');
    setIsStreaming(true);
    pendingTextRef.current = '';

    try {
      for await (const chunk of generator) {
        if (abortRef.current) break;
        
        // 累积文本
        pendingTextRef.current += chunk;
        
        // 防抖更新：每 50ms 更新一次 UI
        if (!updateTimerRef.current) {
          updateTimerRef.current = window.setTimeout(() => {
            setStreamingText(pendingTextRef.current);
            onChunk?.(pendingTextRef.current);
            updateTimerRef.current = null;
          }, 50);
        }
      }
      
      // 确保最后更新一次
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      setStreamingText(pendingTextRef.current);
      onChunk?.(pendingTextRef.current);
      
    } catch (err) {
      // 流被中断或出错，保留已累积的文本
      if (!abortRef.current) {
        console.warn('Stream error:', err);
      }
    } finally {
      setIsStreaming(false);
      updateTimerRef.current = null;
    }

    return pendingTextRef.current;
  }, []);

  const stopStream = useCallback(() => {
    abortRef.current = true;
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
    }
  }, []);

  return { streamingText, isStreaming, startStream, stopStream };
}
