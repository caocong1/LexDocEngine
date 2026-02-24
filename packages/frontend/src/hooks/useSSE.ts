import { createSignal, onCleanup } from 'solid-js';

export interface SSEChunk {
  content: string;
  finishReason?: string;
}

export interface UseSSEResult {
  content: () => string;
  isStreaming: () => boolean;
  error: () => string | null;
  startStream: (response: Response) => Promise<void>;
  reset: () => void;
}

/**
 * SSE 流式接收 Hook
 * 用于处理后端的 Server-Sent Events 流式响应
 */
export function useSSE(): UseSSEResult {
  const [content, setContent] = createSignal('');
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const reset = () => {
    setContent('');
    setIsStreaming(false);
    setError(null);
    if (reader) {
      reader.cancel();
      reader = null;
    }
  };

  const startStream = async (response: Response) => {
    if (!response.ok) {
      setError(`HTTP Error: ${response.status}`);
      return;
    }

    if (!response.body) {
      setError('Response body is null');
      return;
    }

    setIsStreaming(true);
    setError(null);
    setContent('');

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();

            try {
              const parsed = JSON.parse(data);

              // 处理错误事件
              if (parsed.error) {
                setError(parsed.error);
                setIsStreaming(false);
                return;
              }

              // 处理 chunk 事件
              if (parsed.content) {
                setContent((prev) => prev + parsed.content);
              }

              // 处理 done 事件
              if (parsed.done) {
                setIsStreaming(false);
                return;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', data, e);
            }
          } else if (line.startsWith('event:')) {
            // SSE 事件类型（chunk, done, error）
            const eventType = line.slice(6).trim();
            if (eventType === 'error') {
              // 下一行的 data 会包含错误信息
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Stream error');
    } finally {
      setIsStreaming(false);
    }
  };

  onCleanup(() => {
    if (reader) {
      reader.cancel();
    }
  });

  return {
    content,
    isStreaming,
    error,
    startStream,
    reset,
  };
}
