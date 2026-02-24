import { Hono } from 'hono';
import { db, libraryDocuments, documentLibraryLinks } from '../db';
import { eq, and } from 'drizzle-orm';

const uploadRoutes = new Hono();

// 关联文档库文件到文书
uploadRoutes.post('/:id/references', async (c) => {
  try {
    const documentId = c.req.param('id');
    const { libraryDocId } = await c.req.json<{ libraryDocId: string }>();

    if (!libraryDocId) {
      return c.json({ error: 'libraryDocId is required' }, 400);
    }

    // 检查文档库文件是否存在
    const [libDoc] = await db
      .select()
      .from(libraryDocuments)
      .where(eq(libraryDocuments.id, libraryDocId));

    if (!libDoc) {
      return c.json({ error: 'Library document not found' }, 404);
    }

    // 创建关联（忽略重复）
    const [link] = await db
      .insert(documentLibraryLinks)
      .values({ documentId, libraryDocId })
      .onConflictDoNothing()
      .returning();

    return c.json({ link: link || { documentId, libraryDocId }, libraryDoc: libDoc }, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to link reference' }, 500);
  }
});

// 列出文书关联的文档库文件
uploadRoutes.get('/:id/references', async (c) => {
  try {
    const documentId = c.req.param('id');

    const references = await db
      .select({
        id: libraryDocuments.id,
        originalFileName: libraryDocuments.originalFileName,
        fileType: libraryDocuments.fileType,
        fileSize: libraryDocuments.fileSize,
        processingStatus: libraryDocuments.processingStatus,
        errorMessage: libraryDocuments.errorMessage,
        chunkCount: libraryDocuments.chunkCount,
        createdAt: libraryDocuments.createdAt,
      })
      .from(documentLibraryLinks)
      .innerJoin(libraryDocuments, eq(documentLibraryLinks.libraryDocId, libraryDocuments.id))
      .where(eq(documentLibraryLinks.documentId, documentId))
      .orderBy(libraryDocuments.createdAt);

    return c.json({ references });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to list references' }, 500);
  }
});

// 取消关联（不删除文档库文件）
uploadRoutes.delete('/:id/references/:libDocId', async (c) => {
  try {
    const documentId = c.req.param('id');
    const libDocId = c.req.param('libDocId');

    await db
      .delete(documentLibraryLinks)
      .where(
        and(
          eq(documentLibraryLinks.documentId, documentId),
          eq(documentLibraryLinks.libraryDocId, libDocId),
        ),
      );

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to unlink reference' }, 500);
  }
});

export default uploadRoutes;
