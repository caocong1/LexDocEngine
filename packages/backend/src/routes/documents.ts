import { Hono } from 'hono';
import * as documentService from '../services/document';
import { exportToLegalMemo } from '../services/export';

const documentRoutes = new Hono();

// 获取文书列表（按时间倒序 + 分页）
documentRoutes.get('/', async (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 20;
    const offset = Number(c.req.query('offset')) || 0;

    const { documents, total } = await documentService.listDocuments(limit, offset);

    return c.json({ documents, total });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to list documents' }, 500);
  }
});

// 创建新文书
documentRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { title, factInput, aiProvider, templateId, metadata, additionalNotes } = body;

    if (!title || !factInput) {
      return c.json({ error: 'Missing required fields: title, factInput' }, 400);
    }

    const document = await documentService.createDocument({
      title,
      factInput,
      aiProvider,
      templateId,
      metadata,
      additionalNotes,
    });

    return c.json({ document }, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to create document' }, 500);
  }
});

// 获取单个文书详情
documentRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const document = await documentService.getDocument(id);

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    return c.json({ document });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get document' }, 500);
  }
});

// 更新文书基本信息
documentRoutes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { title, status, factInput, additionalNotes } = body;

    const document = await documentService.updateDocument(id, {
      title,
      status,
      factInput,
      additionalNotes,
    });

    return c.json({ document });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update document' }, 500);
  }
});

// 更新文书元数据
documentRoutes.put('/:id/metadata', async (c) => {
  try {
    const id = c.req.param('id');
    const metadata = await c.req.json();

    const document = await documentService.updateDocumentMetadata(id, metadata);

    return c.json({ document });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update metadata' }, 500);
  }
});

// 删除文书
documentRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await documentService.deleteDocument(id);

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to delete document' }, 500);
  }
});

// 保存区块内容
documentRoutes.post('/:id/sections', async (c) => {
  try {
    const documentId = c.req.param('id');
    const body = await c.req.json();
    const { sectionKey, contentHtml, contentJson, generationPrompt, aiProvider } = body;

    if (!sectionKey || !contentHtml) {
      return c.json({ error: 'Missing required fields: sectionKey, contentHtml' }, 400);
    }

    const section = await documentService.saveSectionContent({
      documentId,
      sectionKey,
      contentHtml,
      contentJson: contentJson || {},
      generationPrompt,
      aiProvider,
    });

    return c.json({ section }, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to save section' }, 500);
  }
});

// 导出文书为 docx
documentRoutes.get('/:id/export', async (c) => {
  try {
    const id = c.req.param('id');
    const document = await documentService.getDocument(id);

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    const metadata = document.metadata || {};
    const sections = document.sections || [];

    // 直接从 sections 读取各段落纯文本
    const basicFacts = sections.find((s: any) => s.sectionKey === '基本事实')?.contentHtml
      || document.factInput || '';
    const legalOpinion = sections.find((s: any) => s.sectionKey === '法律意见')?.contentHtml
      || '';
    const recommendations = sections.find((s: any) => s.sectionKey === '律师建议')?.contentHtml
      || '以上意见仅供参考。';

    console.log('📄 Export: Using individual sections (basic_facts, legal_opinion, recommendations)');

    const docxBuffer = await exportToLegalMemo({
      title: document.title,
      factInput: document.factInput,
      content: '',
      createdAt: document.createdAt,
      aiProvider: document.aiProvider,
      clientName: metadata.clientName,
      caseTitle: metadata.caseTitle || document.title,
      basicFacts,
      legalOpinion,
      recommendations,
      chineseDate: metadata.chineseDate,
    });

    c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(document.title)}.docx"`);

    return c.body(docxBuffer);
  } catch (error: any) {
    console.error('Export error:', error);
    return c.json({ error: error.message || 'Failed to export document' }, 500);
  }
});

export default documentRoutes;
