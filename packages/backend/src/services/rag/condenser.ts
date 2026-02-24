import { registry } from '../ai/registry';
import { ragConfig } from '../../config/rag.config';
import { getLinkedDocumentTexts } from './fulltext';

export interface CondenseParams {
  factInput: string;
  additionalNotes?: string;
  sectionTitle: string;
  documentId: string;
}

const CONDENSER_SYSTEM_PROMPT = `你是一位专业的法律文书助理。你的任务是通读参考文档全文，从中提取与案件直接相关的关键信息，生成精炼的摘要供后续法律分析使用。

要求：
1. 通读全部参考文档，不遗漏任何可能相关的条款
2. 准确引用合同条款号、法律条文号，保留原文关键措辞
3. 提取与案件事实直接相关的：合同条款、权利义务约定、违约责任、保修条款、赔偿约定等
4. 按主题归类组织（如：合同主要条款、质保与保修约定、违约与赔偿条款、其他相关约定）
5. 保持客观，只做信息提取，不做法律分析或评价
6. 引用条款时注明来源文件名`;

/**
 * 使用长文本模型（qwen-long）通读参考文档全文
 * 提取与案件相关的关键信息，生成精炼摘要供 farui-plus 使用
 *
 * 相比 RAG 分块检索，全文阅读的优势：
 * - 零信息损失：不会因向量相似度不够而漏掉重要条款
 * - 上下文完整：能理解条款之间的关联关系
 * - 更精准：结合案件事实做有针对性的提取
 */
export async function condenseContext(params: CondenseParams): Promise<string> {
  const condenserModel = ragConfig.condenserModel;
  if (!condenserModel) return '';

  let provider;
  try {
    provider = registry.get(condenserModel);
  } catch {
    console.warn(`Condenser model "${condenserModel}" not registered, skipping condensation`);
    return '';
  }

  // 获取关联文档的全文
  const linkedDocs = await getLinkedDocumentTexts(params.documentId);
  if (linkedDocs.length === 0) return '';

  // 拼接所有文档全文
  let fullText = '';
  for (const doc of linkedDocs) {
    fullText += `========== ${doc.originalFileName} ==========\n${doc.extractedText}\n\n`;
  }

  const userPrompt = `请通读以下参考文档全文，提取与本案直接相关的关键信息。

【案件事实】
${params.factInput}

${params.additionalNotes ? `【关注要点】\n${params.additionalNotes}\n` : ''}
【参考文档全文】
${fullText}

请提炼出与本案最相关的合同条款、法律条文、关键约定，生成精炼摘要。要求：
- 保留关键条款的原文措辞
- 注明来源文件名和条款号
- 不超过2000字`;

  try {
    const result = await provider.generate({
      systemPrompt: CONDENSER_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: ragConfig.condenserMaxOutputTokens,
      temperature: 0.1,
    });
    return result.content;
  } catch (err: any) {
    console.warn('Context condensation failed, falling back to RAG:', err.message);
    return '';
  }
}
