import { db, libraryDocuments } from '../../db';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { extractText } from './textExtractor';
import { chunkText } from './chunker';
import { getEmbeddings } from './embedding';

export async function processLibraryDocument(libDocId: string): Promise<void> {
  const [libDoc] = await db
    .select()
    .from(libraryDocuments)
    .where(eq(libraryDocuments.id, libDocId));

  if (!libDoc) throw new Error(`Library document ${libDocId} not found`);

  try {
    // 1. Extract text (may trigger OCR for image-based PDFs)
    await updateStatus(libDocId, 'extracting');
    const extracted = await extractText(libDoc.filePath, libDoc.fileType as 'pdf' | 'docx');

    if (extracted.usedOcr) {
      await updateStatus(libDocId, 'ocr');
    }

    await db
      .update(libraryDocuments)
      .set({ extractedText: extracted.text })
      .where(eq(libraryDocuments.id, libDocId));

    // 2. Chunk text
    await updateStatus(libDocId, 'chunking');
    const chunks = chunkText(extracted.text);

    if (chunks.length === 0) {
      await db
        .update(libraryDocuments)
        .set({ processingStatus: 'ready', chunkCount: 0 })
        .where(eq(libraryDocuments.id, libDocId));
      return;
    }

    // 3. Generate embeddings
    await updateStatus(libDocId, 'embedding');
    const embeddings = await getEmbeddings(chunks.map(c => c.content));

    // 4. Store chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embeddingVector = embeddings[i].embedding;
      const embeddingStr = `[${embeddingVector.join(',')}]`;

      await db.execute(sql`
        INSERT INTO document_chunks (
          id, library_doc_id, chunk_index, content,
          token_count, embedding, metadata, created_at
        ) VALUES (
          gen_random_uuid(),
          ${libDocId},
          ${chunk.index},
          ${chunk.content},
          ${chunk.tokenCount},
          ${embeddingStr}::vector,
          ${JSON.stringify({ sourceFile: libDoc.originalFileName, chunkIndex: chunk.index })}::jsonb,
          now()
        )
      `);
    }

    // 5. Mark as ready
    await db
      .update(libraryDocuments)
      .set({ processingStatus: 'ready', chunkCount: chunks.length })
      .where(eq(libraryDocuments.id, libDocId));

  } catch (error: any) {
    console.error(`Processing library document ${libDocId} failed:`, error);
    await db
      .update(libraryDocuments)
      .set({
        processingStatus: 'error',
        errorMessage: error.message,
      })
      .where(eq(libraryDocuments.id, libDocId));
  }
}

async function updateStatus(libDocId: string, status: string) {
  await db
    .update(libraryDocuments)
    .set({ processingStatus: status })
    .where(eq(libraryDocuments.id, libDocId));
}
