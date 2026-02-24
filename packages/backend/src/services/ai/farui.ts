import type { AIProvider, GenerateParams, StreamChunk, GenerateResult } from './provider';

export class FaruiProvider implements AIProvider {
  id = 'farui-plus';
  name = '通义法睿';

  private apiKey: string;
  private baseURL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️  DASHSCOPE_API_KEY is not set in environment variables');
    }
  }

  async *streamGenerate(params: GenerateParams): AsyncGenerator<StreamChunk> {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-DashScope-SSE': 'enable',
      },
      body: JSON.stringify({
        model: 'farui-plus',
        input: {
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
          ],
        },
        parameters: {
          result_format: 'message',
          max_tokens: params.maxTokens ?? 2000,
          temperature: params.temperature ?? 0.7,
          incremental_output: true,  // SSE 增量输出
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DashScope API error: ${response.status} ${error}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // 处理 SSE 流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let readCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log(`[farui.stream] stream done after ${readCount} reads, remaining buffer(${buffer.length}):`, buffer.slice(0, 200));
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      readCount++;
      if (readCount <= 3) {
        console.log(`[farui.stream] read#${readCount} (${chunk.length} bytes):`, chunk.slice(0, 300));
      }

      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.output?.choices?.[0]?.message?.content || '';
            const finishReason = parsed.output?.choices?.[0]?.finish_reason;

            // 调试日志：仅打印前3个chunk和最后一个（finish时）
            if (!content && finishReason) {
              console.log(`[farui.stream] finish_reason=${finishReason}, content empty, raw keys:`, Object.keys(parsed));
            }

            if (content) {
              yield {
                content,
                finishReason: finishReason as any,
              };
            }

            // 只有在真正结束时才退出（stop/length），字符串"null"不算
            if (finishReason && finishReason !== 'null') {
              return;
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', data, e);
          }
        }
      }
    }
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    // 内部使用 SSE 流式调用，收集完整结果后返回
    // 避免 DashScope 同步接口对长内容生成超时/500 错误
    let content = '';
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let chunkCount = 0;
    for await (const chunk of this.streamGenerate(params)) {
      content += chunk.content;
      chunkCount++;
    }
    console.log(`[farui.generate] collected ${chunkCount} chunks, content length: ${content.length}`);
    return { content, usage };
  }
}
