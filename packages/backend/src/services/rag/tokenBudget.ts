import { ragConfig } from '../../config/rag.config';
import { estimateTokens } from './chunker';

export interface RetrievedContext {
  content: string;
  sourceFile: string;
  similarity: number;
}

export function truncateToTokenBudget(text: string, maxTokens: number): string {
  const estimated = estimateTokens(text);
  if (estimated <= maxTokens) return text;

  const ratio = maxTokens / estimated;
  const cutoff = Math.floor(text.length * ratio * 0.95);
  return text.substring(0, cutoff) + '\n...(内容已截断)';
}

export function allocateTokenBudget(
  factInput: string,
  additionalNotes: string | undefined,
  retrievedChunks: RetrievedContext[],
): {
  truncatedFacts: string;
  truncatedNotes: string;
  selectedChunks: RetrievedContext[];
} {
  const totalBudget = ragConfig.maxInputTokens;
  const overhead = ragConfig.systemPromptTokens + ragConfig.promptTemplateTokens;
  let remaining = totalBudget - overhead;

  // 1. Facts get priority
  const truncatedFacts = truncateToTokenBudget(
    factInput,
    Math.min(remaining, ragConfig.maxFactTokens),
  );
  remaining -= estimateTokens(truncatedFacts);

  // 2. Notes get second priority
  const truncatedNotes = additionalNotes
    ? truncateToTokenBudget(additionalNotes, Math.min(remaining, ragConfig.maxNotesTokens))
    : '';
  remaining -= estimateTokens(truncatedNotes);

  // 3. Retrieved chunks fill the rest (highest similarity first)
  const selectedChunks: RetrievedContext[] = [];
  for (const chunk of retrievedChunks) {
    const chunkTokens = estimateTokens(chunk.content) + 20; // 20 tokens for source label overhead
    if (chunkTokens > remaining) break;
    selectedChunks.push(chunk);
    remaining -= chunkTokens;
  }

  return { truncatedFacts, truncatedNotes, selectedChunks };
}
