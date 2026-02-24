import { pgTable, uuid, varchar, text, jsonb, integer, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { vector } from './customTypes';

// 文书模板
export const documentTemplates = pgTable('document_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  templateFilePath: varchar('template_file_path', { length: 500 }).notNull(),
  sections: jsonb('sections').notNull(),              // SectionDefinition[]
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 文书实例
export const documentInstances = pgTable('document_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').references(() => documentTemplates.id),
  title: varchar('title', { length: 255 }).notNull(),
  factInput: text('fact_input').notNull(),
  additionalNotes: text('additional_notes'),           // 附加说明
  status: varchar('status', { length: 20 }).default('draft'),
  aiProvider: varchar('ai_provider', { length: 50 }).default('farui-plus'),
  metadata: jsonb('metadata'),                         // 元数据：clientName, caseTitle, chineseDate等
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 区块内容（独立表，便于版本追踪）
export const sectionContents = pgTable('section_contents', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documentInstances.id),
  sectionKey: varchar('section_key', { length: 100 }).notNull(),
  contentJson: jsonb('content_json').notNull(),        // Tiptap JSON
  contentHtml: text('content_html').notNull(),
  version: integer('version').default(1),
  lastEditedBy: varchar('last_edited_by', { length: 10 }).default('ai'),
  generationPrompt: text('generation_prompt'),
  aiProvider: varchar('ai_provider', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// 文档库
export const libraryDocuments = pgTable('library_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileHash: varchar('file_hash', { length: 64 }).unique().notNull(),
  originalFileName: varchar('original_file_name', { length: 500 }).notNull(),
  fileType: varchar('file_type', { length: 10 }).notNull(),     // 'pdf' | 'docx'
  filePath: varchar('file_path', { length: 1000 }).notNull(),
  fileSize: integer('file_size'),
  extractedText: text('extracted_text'),
  processingStatus: varchar('processing_status', { length: 20 }).default('pending'),
  errorMessage: text('error_message'),
  chunkCount: integer('chunk_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// 文书-文档库关联（多对多）
export const documentLibraryLinks = pgTable('document_library_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documentInstances.id, { onDelete: 'cascade' }).notNull(),
  libraryDocId: uuid('library_doc_id').references(() => libraryDocuments.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  unique('uq_doc_library').on(table.documentId, table.libraryDocId),
]);

// 文档向量块
export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  libraryDocId: uuid('library_doc_id').references(() => libraryDocuments.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count'),
  embedding: vector('embedding', { dimensions: 1024 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_chunks_library_doc_id').on(table.libraryDocId),
]);

// 类型定义
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type NewDocumentTemplate = typeof documentTemplates.$inferInsert;

export type DocumentInstance = typeof documentInstances.$inferSelect;
export type NewDocumentInstance = typeof documentInstances.$inferInsert;

export type SectionContent = typeof sectionContents.$inferSelect;
export type NewSectionContent = typeof sectionContents.$inferInsert;

export type LibraryDocument = typeof libraryDocuments.$inferSelect;
export type NewLibraryDocument = typeof libraryDocuments.$inferInsert;

export type DocumentLibraryLink = typeof documentLibraryLinks.$inferSelect;
export type NewDocumentLibraryLink = typeof documentLibraryLinks.$inferInsert;

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
