import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { registry } from '../services/ai/registry';
import { SYSTEM_PROMPT, REWRITE_SYSTEM_PROMPT, buildSectionPrompt, buildRewritePrompt } from '../services/ai/prompts';
import { retrieveRelevantChunks } from '../services/rag/retriever';
import { allocateTokenBudget } from '../services/rag/tokenBudget';
import { condenseContext } from '../services/rag/condenser';
import { ragConfig } from '../config/rag.config';

const aiRoutes = new Hono();

/**
 * 共用的参考资料处理逻辑
 * 优先：qwen-long 全文阅读 → 提炼精华摘要
 * 降级：RAG 向量检索 → token budget 裁剪
 */
async function retrieveAndPrepareContext(params: {
  factInput: string;
  sectionTitle: string;
  additionalNotes?: string;
  documentId?: string;
}) {
  const { factInput, sectionTitle, additionalNotes, documentId } = params;
  type ContextItem = { content: string; sourceFile: string; similarity: number };

  if (!documentId) {
    const { truncatedFacts, truncatedNotes } = allocateTokenBudget(factInput, additionalNotes, []);
    return { truncatedFacts, truncatedNotes, selectedChunks: [] as ContextItem[] };
  }

  // 阶段1：尝试用 qwen-long 通读全文提炼
  if (ragConfig.condenserModel) {
    const condensed = await condenseContext({
      factInput,
      additionalNotes,
      sectionTitle,
      documentId,
    });

    if (condensed) {
      const condensedContext: ContextItem[] = [
        { content: condensed, sourceFile: '参考资料精华摘要', similarity: 1 },
      ];
      const { truncatedFacts, truncatedNotes, selectedChunks } = allocateTokenBudget(
        factInput, additionalNotes, condensedContext,
      );
      return { truncatedFacts, truncatedNotes, selectedChunks };
    }
  }

  // 降级：RAG 向量检索 + token budget 裁剪
  let retrievedContext: ContextItem[] = [];
  try {
    const query = additionalNotes ? `${factInput}\n${additionalNotes}` : factInput;
    const chunks = await retrieveRelevantChunks(documentId, query, ragConfig.topK);
    retrievedContext = chunks.map(c => ({
      content: c.content,
      sourceFile: c.originalFileName,
      similarity: c.similarity,
    }));
  } catch (err: any) {
    console.warn('RAG retrieval failed, continuing without context:', err.message);
  }

  const { truncatedFacts, truncatedNotes, selectedChunks } = allocateTokenBudget(
    factInput, additionalNotes, retrievedContext,
  );
  return { truncatedFacts, truncatedNotes, selectedChunks };
}

// AI 流式生成（支持 RAG 检索 + 上下文提炼）
aiRoutes.post('/test-generate', async (c) => {
  try {
    const {
      factInput,
      sectionTitle,
      providerId = 'farui-plus',
      additionalNotes,
      documentId,
    } = await c.req.json();

    if (!factInput || !sectionTitle) {
      return c.json({ error: 'Missing factInput or sectionTitle' }, 400);
    }

    const { truncatedFacts, truncatedNotes, selectedChunks } = await retrieveAndPrepareContext({
      factInput, sectionTitle, additionalNotes, documentId,
    });

    const provider = registry.get(providerId);
    const userPrompt = buildSectionPrompt({
      factInput: truncatedFacts,
      sectionTitle,
      additionalNotes: truncatedNotes || undefined,
      retrievedContext: selectedChunks.length > 0 ? selectedChunks : undefined,
    });

    return streamSSE(c, async (stream) => {
      try {
        for await (const chunk of provider.streamGenerate({
          systemPrompt: SYSTEM_PROMPT,
          userPrompt,
        })) {
          await stream.writeSSE({
            data: JSON.stringify({
              content: chunk.content,
              finishReason: chunk.finishReason,
            }),
            event: 'chunk',
          });
        }

        await stream.writeSSE({
          data: JSON.stringify({ done: true }),
          event: 'done',
        });
      } catch (error: any) {
        await stream.writeSSE({
          data: JSON.stringify({ error: error.message || 'Generation failed' }),
          event: 'error',
        });
      }
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Request failed' }, 500);
  }
});

// AI 改写：选中文字 + 改写指令 → 流式返回改写后的文本
aiRoutes.post('/rewrite', async (c) => {
  try {
    const {
      sectionKey,
      selectedText,
      fullSectionContent,
      instruction,
      factInput,
      providerId = 'farui-plus',
    } = await c.req.json();

    if (!selectedText || !instruction) {
      return c.json({ error: 'Missing selectedText or instruction' }, 400);
    }

    const provider = registry.get(providerId);
    const userPrompt = buildRewritePrompt({
      sectionKey,
      selectedText,
      fullSectionContent,
      instruction,
      factInput,
    });

    return streamSSE(c, async (stream) => {
      try {
        for await (const chunk of provider.streamGenerate({
          systemPrompt: REWRITE_SYSTEM_PROMPT,
          userPrompt,
        })) {
          await stream.writeSSE({
            data: JSON.stringify({
              content: chunk.content,
              finishReason: chunk.finishReason,
            }),
            event: 'chunk',
          });
        }

        await stream.writeSSE({
          data: JSON.stringify({ done: true }),
          event: 'done',
        });
      } catch (error: any) {
        await stream.writeSSE({
          data: JSON.stringify({ error: error.message || 'Rewrite failed' }),
          event: 'error',
        });
      }
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Rewrite request failed' }, 500);
  }
});

// AI 非流式生成（用于基本事实润色、律师建议等较短内容）
aiRoutes.post('/generate', async (c) => {
  try {
    const {
      factInput,
      sectionTitle,
      providerId = 'farui-plus',
      additionalNotes,
      documentId,
      legalOpinion,
    } = await c.req.json();

    if (!factInput || !sectionTitle) {
      return c.json({ error: 'Missing factInput or sectionTitle' }, 400);
    }

    // 律师建议：法律意见已消化过参考资料，不再重复检索
    const needContext = sectionTitle !== '律师建议' || !legalOpinion;
    let truncatedFacts = factInput;
    let truncatedNotes = additionalNotes;
    let selectedChunks: { content: string; sourceFile: string; similarity: number }[] = [];

    if (needContext) {
      const ctx = await retrieveAndPrepareContext({
        factInput, sectionTitle, additionalNotes, documentId,
      });
      truncatedFacts = ctx.truncatedFacts;
      truncatedNotes = ctx.truncatedNotes;
      selectedChunks = ctx.selectedChunks;
    }

    // 构建 previousSections：把已生成的法律意见传给律师建议
    const previousSections = legalOpinion
      ? [{ title: '法律意见', contentHtml: legalOpinion }]
      : undefined;

    const provider = registry.get(providerId);
    const userPrompt = buildSectionPrompt({
      factInput: truncatedFacts,
      sectionTitle,
      additionalNotes: truncatedNotes || undefined,
      retrievedContext: selectedChunks.length > 0 ? selectedChunks : undefined,
      previousSections,
    });

    const result = await provider.generate({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
    });

    return c.json({ content: result.content, usage: result.usage });
  } catch (error: any) {
    return c.json({ error: error.message || 'Generation failed' }, 500);
  }
});

// 根据基础事实+法律意见+律师建议生成案件标题摘要
aiRoutes.post('/summarize-title', async (c) => {
  try {
    const { factInput, additionalNotes, legalOpinion, advice, providerId = 'farui-plus' } = await c.req.json();

    if (!factInput) {
      return c.json({ error: 'Missing factInput' }, 400);
    }

    let context = `案件事实：\n${factInput}`;
    if (additionalNotes) context += `\n\n附加说明：\n${additionalNotes}`;
    if (legalOpinion) context += `\n\n法律意见摘要：\n${legalOpinion.slice(0, 500)}`;
    if (advice) context += `\n\n律师建议摘要：\n${advice.slice(0, 300)}`;

    const provider = registry.get(providerId);
    const result = await provider.generate({
      systemPrompt: '你是一位专业的法律文书助手。',
      userPrompt: `请根据以下信息，用一个短语概括案件主题，用于法律意见书标题。要求：
- 10个字以内
- 高度概括，不要写具体细节
- 不要以"关于"开头
- 格式示例："劳动争议相关事宜"、"股权转让相关事宜"、"合同纠纷相关事宜"
- 只输出短语本身

${context}`,
      maxTokens: 50,
      temperature: 0.3,
    });

    const title = result.content.trim().replace(/^["「『]|["」』]$/g, '');
    return c.json({ title });
  } catch (error: any) {
    return c.json({ error: error.message || 'Summarize failed' }, 500);
  }
});

// 获取可用的 AI Provider 列表
aiRoutes.get('/providers', (c) => {
  const providers = registry.listAll().map((p) => ({
    id: p.id,
    name: p.name,
  }));
  return c.json({ providers });
});

export default aiRoutes;
