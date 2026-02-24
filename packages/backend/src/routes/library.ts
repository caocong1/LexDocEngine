import { Hono } from 'hono';
import { db, libraryDocuments, documentChunks, documentLibraryLinks } from '../db';
import { eq, desc, like, sql } from 'drizzle-orm';
import { ragConfig } from '../config/rag.config';
import { processLibraryDocument } from '../services/rag/pipeline';
import path from 'path';

const libraryRoutes = new Hono();

// 上传文件到文档库
libraryRoutes.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    // Validate file type
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ragConfig.allowedFileTypes.includes(ext as any)) {
      return c.json({ error: `Unsupported file type. Allowed: ${ragConfig.allowedFileTypes.join(', ')}` }, 400);
    }

    // 计算文件 SHA-256 hash
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = new Uint8Array(hashBuffer);
    const fileHash = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

    // 检查是否已存在相同 hash 的文件
    const [existing] = await db
      .select()
      .from(libraryDocuments)
      .where(eq(libraryDocuments.fileHash, fileHash));

    if (existing) {
      return c.json({ libraryDoc: existing, duplicate: true }, 200);
    }

    // 保存文件
    const uploadDir = path.resolve(import.meta.dir, '../../uploads');
    const timestamp = Date.now();
    const safeFileName = `lib_${timestamp}_${file.name.replace(/[^a-zA-Z0-9._\u4e00-\u9fff-]/g, '_')}`;
    const filePath = path.join(uploadDir, safeFileName);
    await Bun.write(filePath, buffer);

    // 插入记录
    const [libDoc] = await db
      .insert(libraryDocuments)
      .values({
        fileHash,
        originalFileName: file.name,
        fileType: ext,
        filePath,
        fileSize: file.size,
        processingStatus: 'pending',
      })
      .returning();

    // 异步处理
    processLibraryDocument(libDoc.id).catch(err => {
      console.error(`Background processing failed for library doc ${libDoc.id}:`, err);
    });

    return c.json({ libraryDoc: libDoc, duplicate: false }, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Upload failed' }, 500);
  }
});

// 列出文档库（分页 + 搜索）
libraryRoutes.get('/', async (c) => {
  try {
    const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
    const offset = Number(c.req.query('offset')) || 0;
    const search = c.req.query('search')?.trim();

    const where = search
      ? like(libraryDocuments.originalFileName, `%${search}%`)
      : undefined;

    const [docs, countResult] = await Promise.all([
      db
        .select({
          id: libraryDocuments.id,
          fileHash: libraryDocuments.fileHash,
          originalFileName: libraryDocuments.originalFileName,
          fileType: libraryDocuments.fileType,
          fileSize: libraryDocuments.fileSize,
          processingStatus: libraryDocuments.processingStatus,
          errorMessage: libraryDocuments.errorMessage,
          chunkCount: libraryDocuments.chunkCount,
          createdAt: libraryDocuments.createdAt,
        })
        .from(libraryDocuments)
        .where(where)
        .orderBy(desc(libraryDocuments.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(libraryDocuments)
        .where(where),
    ]);

    return c.json({ documents: docs, total: countResult[0].count });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to list library' }, 500);
  }
});

// 获取单个文档库文件详情
libraryRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const [doc] = await db
      .select()
      .from(libraryDocuments)
      .where(eq(libraryDocuments.id, id));

    if (!doc) {
      return c.json({ error: 'Library document not found' }, 404);
    }

    return c.json({ libraryDoc: doc });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get library document' }, 500);
  }
});

// 删除文档库文件
libraryRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const [doc] = await db
      .select()
      .from(libraryDocuments)
      .where(eq(libraryDocuments.id, id));

    if (!doc) {
      return c.json({ error: 'Library document not found' }, 404);
    }

    // 删除数据库记录（级联删除 chunks 和 links）
    await db.delete(libraryDocuments).where(eq(libraryDocuments.id, id));

    // 删除物理文件
    try {
      const { unlink } = await import('node:fs/promises');
      await unlink(doc.filePath);
    } catch {
      // File may already be deleted
    }

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to delete library document' }, 500);
  }
});

export default libraryRoutes;
