import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { getEmbedding } from './embedding';
import { ragConfig } from '../../config/rag.config';

export interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
  metadata: any;
  libraryDocId: string;
  originalFileName: string;
}

export async function retrieveRelevantChunks(
  documentId: string,
  query: string,
  topK: number = ragConfig.topK,
  similarityThreshold: number = ragConfig.similarityThreshold,
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await getEmbedding(query);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const results = await db.execute(sql`
    SELECT
      dc.id,
      dc.content,
      dc.metadata,
      dc.library_doc_id,
      ld.original_file_name,
      1 - (dc.embedding <=> ${embeddingStr}::vector) AS similarity
    FROM document_chunks dc
    JOIN library_documents ld ON ld.id = dc.library_doc_id
    JOIN document_library_links dll ON dll.library_doc_id = dc.library_doc_id
    WHERE dll.document_id = ${documentId}
      AND ld.processing_status = 'ready'
    ORDER BY dc.embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `);

  const rows = (results as any).rows || results;

  return rows
    .filter((row: any) => Number(row.similarity) >= similarityThreshold)
    .map((row: any) => ({
      id: row.id,
      content: row.content,
      similarity: Number(row.similarity),
      metadata: row.metadata,
      libraryDocId: row.library_doc_id,
      originalFileName: row.original_file_name,
    }));
}
