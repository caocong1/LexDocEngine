// AI Provider 接口定义

export interface AIProvider {
  id: string;
  name: string;
  streamGenerate(params: GenerateParams): AsyncGenerator<StreamChunk>;
  generate(params: GenerateParams): Promise<GenerateResult>;
}

export interface GenerateParams {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface StreamChunk {
  content: string;
  finishReason?: 'stop' | 'length' | null;
}

export interface GenerateResult {
  content: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
}
