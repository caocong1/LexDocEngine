export const ragConfig = {
  // farui-plus model token limits
  maxInputTokens: 12000,
  maxOutputTokens: 2000,

  // Token allocation for prompt components
  systemPromptTokens: 800,
  promptTemplateTokens: 500,
  maxFactTokens: 3000,
  maxNotesTokens: 1000,
  maxRetrievedContextTokens: 5000,
  maxPreviousSectionsTokens: 1700,

  // Retrieval settings
  topK: 8,
  similarityThreshold: 0.3,
  maxChunksInPrompt: 5,

  // Context condenser (qwen-long reads full document text, extracts key info for farui-plus)
  condenserModel: 'qwen-long' as string | null,   // set to null to disable, falls back to RAG chunks
  condenserMaxOutputTokens: 2000,                   // condenser output budget

  // Chunking settings
  chunkMaxTokens: 500,
  chunkOverlapTokens: 50,

  // Embedding model (DashScope)
  embeddingModel: 'text-embedding-v3',
  embeddingDimensions: 1024,
  embeddingBatchSize: 10,

  // OCR settings (DashScope qwen-vl-plus)
  ocrModel: 'qwen-vl-plus',
  ocrTextDensityThreshold: 50,  // 每页平均字符数低于此值触发 OCR

  // File upload settings
  allowedFileTypes: ['pdf', 'docx'] as const,
  maxFilesPerDocument: 10,
  uploadDir: 'uploads',
};
