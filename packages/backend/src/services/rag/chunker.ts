import { ragConfig } from '../../config/rag.config';

export interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
}

export interface ChunkOptions {
  maxChunkTokens?: number;
  overlapTokens?: number;
}

// Approximate Chinese token count: ~1.5 tokens per Chinese character
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars * 0.25);
}

export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const maxTokens = options.maxChunkTokens || ragConfig.chunkMaxTokens;
  const overlapTokens = options.overlapTokens || ragConfig.chunkOverlapTokens;

  // Split by double newlines (paragraphs) first
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());

  if (paragraphs.length === 0) return [];

  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let currentTokens = 0;
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const paraTokens = estimateTokens(paragraph);

    // If single paragraph exceeds max, split it further by sentences
    if (paraTokens > maxTokens && !currentChunk) {
      const subChunks = splitLargeParagraph(paragraph, maxTokens);
      for (const sub of subChunks) {
        chunks.push({
          content: sub.trim(),
          index: chunkIndex++,
          tokenCount: estimateTokens(sub),
        });
      }
      continue;
    }

    if (currentTokens + paraTokens > maxTokens && currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++,
        tokenCount: currentTokens,
      });

      // Overlap: keep last portion for context continuity
      const lines = currentChunk.split('\n');
      let overlapText = '';
      let overlapCount = 0;
      for (let i = lines.length - 1; i >= 0; i--) {
        const lineTokens = estimateTokens(lines[i]);
        if (overlapCount + lineTokens > overlapTokens) break;
        overlapText = lines[i] + '\n' + overlapText;
        overlapCount += lineTokens;
      }
      currentChunk = overlapText + paragraph;
      currentTokens = overlapCount + paraTokens;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      currentTokens += paraTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
      tokenCount: currentTokens,
    });
  }

  return chunks;
}

function splitLargeParagraph(text: string, maxTokens: number): string[] {
  // Split by Chinese sentence endings or periods
  const sentences = text.split(/(?<=[。！？；\.\!\?])/);
  const parts: string[] = [];
  let current = '';
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentTokens = estimateTokens(sentence);
    if (currentTokens + sentTokens > maxTokens && current) {
      parts.push(current);
      current = sentence;
      currentTokens = sentTokens;
    } else {
      current += sentence;
      currentTokens += sentTokens;
    }
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts;
}
