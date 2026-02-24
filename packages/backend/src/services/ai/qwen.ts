import type { AIProvider, GenerateParams, StreamChunk, GenerateResult } from './provider';

/**
 * Qwen 通用 Provider（OpenAI 兼容接口）
 * 用于长文本预处理、参考资料提炼等非法律专业场景
 */
export class QwenProvider implements AIProvider {
  id: string;
  name: string;

  private apiKey: string;
  private model: string;
  private baseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

  constructor(model = 'qwen3.5-plus', id?: string, name?: string) {
    this.model = model;
    this.id = id || model;
    this.name = name || `通义千问 ${model}`;
    this.apiKey = process.env.DASHSCOPE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️  DASHSCOPE_API_KEY is not set');
    }
  }

  async *streamGenerate(params: GenerateParams): AsyncGenerator<StreamChunk> {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
        max_tokens: params.maxTokens ?? 2000,
        temperature: params.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Qwen API error: ${response.status} ${error}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            const finishReason = parsed.choices?.[0]?.finish_reason;

            if (delta?.content) {
              yield { content: delta.content, finishReason: finishReason as any };
            }

            if (finishReason && finishReason !== 'null') return;
          } catch (e) {
            // skip malformed lines
          }
        }
      }
    }
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    // 内部使用流式调用收集完整结果，避免同步接口对长内容超时
    let content = '';
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    for await (const chunk of this.streamGenerate(params)) {
      content += chunk.content;
    }
    return { content, usage };
  }
}
