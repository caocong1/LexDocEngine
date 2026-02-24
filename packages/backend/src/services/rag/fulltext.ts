import { db } from '../../db';
import { sql } from 'drizzle-orm';

export interface LinkedDocumentText {
  libraryDocId: string;
  originalFileName: string;
  extractedText: string;
}

/**
 * 获取文书关联的所有参考文档的全文内容
 * 直接从 library_documents.extracted_text 读取，不经过 RAG 分块
 */
export async function getLinkedDocumentTexts(documentId: string): Promise<LinkedDocumentText[]> {
  const results = await db.execute(sql`
    SELECT
      ld.id AS library_doc_id,
      ld.original_file_name,
      ld.extracted_text
    FROM library_documents ld
    JOIN document_library_links dll ON dll.library_doc_id = ld.id
    WHERE dll.document_id = ${documentId}
      AND ld.processing_status = 'ready'
      AND ld.extracted_text IS NOT NULL
      AND ld.extracted_text != ''
    ORDER BY ld.created_at
  `);

  const rows = (results as any).rows || results;

  return rows.map((row: any) => ({
    libraryDocId: row.library_doc_id,
    originalFileName: row.original_file_name,
    extractedText: row.extracted_text,
  }));
}
