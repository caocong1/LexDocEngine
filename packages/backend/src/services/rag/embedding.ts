import { ragConfig } from '../../config/rag.config';

const EMBEDDING_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';

export interface EmbeddingResult {
  embedding: number[];
}

export async function getEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY not set');

  const batchSize = ragConfig.embeddingBatchSize;
  const allResults: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await fetch(EMBEDDING_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: ragConfig.embeddingModel,
        input: {
          texts: batch,
        },
        parameters: {
          dimension: ragConfig.embeddingDimensions,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DashScope Embedding API error: ${response.status} ${error}`);
    }

    const data: any = await response.json();

    if (data.code) {
      throw new Error(`DashScope Embedding error: ${data.code} ${data.message}`);
    }

    const embeddings = data.output?.embeddings || [];
    for (const emb of embeddings) {
      allResults.push({ embedding: emb.embedding });
    }
  }

  return allResults;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const results = await getEmbeddings([text]);
  if (results.length === 0) throw new Error('No embedding returned');
  return results[0].embedding;
}
