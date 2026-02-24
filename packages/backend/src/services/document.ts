import { db, documentInstances, sectionContents, libraryDocuments, documentLibraryLinks } from '../db';
import { eq, desc, count, and } from 'drizzle-orm';

/**
 * 文书服务层 - 处理文书的增删改查
 */

// 创建新文书
export async function createDocument(data: {
  title: string;
  factInput: string;
  aiProvider?: string;
  templateId?: string;
  metadata?: any;
  additionalNotes?: string;
}) {
  const [document] = await db
    .insert(documentInstances)
    .values({
      title: data.title,
      factInput: data.factInput,
      aiProvider: data.aiProvider || 'farui-plus',
      templateId: data.templateId || null,
      status: 'draft',
      metadata: data.metadata || null,
      additionalNotes: data.additionalNotes || null,
    })
    .returning();

  return document;
}

// 获取文书列表（按时间倒序 + 返回总数）
export async function listDocuments(limit = 20, offset = 0) {
  const [documents, [{ total }]] = await Promise.all([
    db
      .select()
      .from(documentInstances)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(documentInstances.createdAt)),
    db
      .select({ total: count() })
      .from(documentInstances),
  ]);

  return { documents, total };
}

// 获取单个文书详情（包含所有区块内容和关联的文档库文件）
export async function getDocument(id: string) {
  const [document] = await db
    .select()
    .from(documentInstances)
    .where(eq(documentInstances.id, id));

  if (!document) {
    return null;
  }

  // 获取该文书的所有区块内容
  const sections = await db
    .select()
    .from(sectionContents)
    .where(eq(sectionContents.documentId, id))
    .orderBy(sectionContents.createdAt);

  // 获取该文书关联的文档库文件
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
    .where(eq(documentLibraryLinks.documentId, id))
    .orderBy(libraryDocuments.createdAt);

  return {
    ...document,
    sections,
    references,
  };
}

// 保存区块内容（UPSERT：先删旧记录再插入，同时清理历史重复行）
export async function saveSectionContent(data: {
  documentId: string;
  sectionKey: string;
  contentHtml: string;
  contentJson: any;
  generationPrompt?: string;
  aiProvider?: string;
}) {
  // 删除该 (documentId, sectionKey) 下的所有旧记录
  await db.delete(sectionContents).where(
    and(
      eq(sectionContents.documentId, data.documentId),
      eq(sectionContents.sectionKey, data.sectionKey),
    )
  );

  // 插入新记录
  const [section] = await db
    .insert(sectionContents)
    .values({
      documentId: data.documentId,
      sectionKey: data.sectionKey,
      contentHtml: data.contentHtml,
      contentJson: data.contentJson,
      generationPrompt: data.generationPrompt || null,
      aiProvider: data.aiProvider || 'farui-plus',
      version: 1,
      lastEditedBy: data.aiProvider === 'user' ? 'user' : 'ai',
    })
    .returning();

  return section;
}

// 更新文书基本信息
export async function updateDocument(id: string, data: {
  title?: string;
  status?: string;
  factInput?: string;
  additionalNotes?: string;
}) {
  const [updated] = await db
    .update(documentInstances)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(documentInstances.id, id))
    .returning();

  return updated;
}

// 更新文书元数据
export async function updateDocumentMetadata(id: string, metadata: any) {
  const [updated] = await db
    .update(documentInstances)
    .set({
      metadata,
      updatedAt: new Date(),
    })
    .where(eq(documentInstances.id, id))
    .returning();

  return updated;
}

// 删除文书（document_library_links 通过 CASCADE 自动删除）
export async function deleteDocument(id: string) {
  // 先删除相关的区块内容（无 CASCADE 外键）
  await db.delete(sectionContents).where(eq(sectionContents.documentId, id));

  // 删除文书本身（document_library_links 通过 CASCADE 自动删除）
  await db.delete(documentInstances).where(eq(documentInstances.id, id));

  return { success: true };
}
