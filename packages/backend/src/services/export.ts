import carbone from 'carbone';
import { promisify } from 'util';
import path from 'path';
import PizZip from 'pizzip';
import { getLawFirmName, getDefaultClientName } from '../config/export.config';

const carboneRender = promisify(carbone.render);

/**
 * 导出服务 - 使用 Carbone 将内容填充到 Word 模板
 */

/**
 * 从 HTML 中提取纯文本内容，保留换行结构
 * 向后兼容：旧数据可能包含 HTML 标签
 */
function extractTextFromHtml(html: string): string {
  if (!html) return '';

  try {
    let text = html;
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n\n');
    text = text.replace(/<(p|div|h[1-6]|li|tr|blockquote)[\s>]/gi, '\n');
    text = text.replace(/<[^>]*>/g, '');
    text = text.replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/[ \t]+\n/g, '\n');
    text = text.replace(/\n[ \t]+/g, '\n');
    return text.trim();
  } catch (error) {
    console.error('Failed to parse HTML:', error);
    return html.replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

export interface ExportData {
  title: string;
  factInput: string;
  content: string;
  sections?: Array<{
    sectionKey: string;
    contentHtml: string;
  }>;
  createdAt?: string;
  aiProvider?: string;
  clientName?: string;
  caseTitle?: string;
  lawFirm?: string;
  basicFacts?: string;
  legalOpinion?: string;
  recommendations?: string;
  chineseDate?: string;
}

/**
 * 使用法律备忘录模板导出
 * 各段落内容现在直接作为纯文本传入，无需 HTML 提取
 */
export async function exportToLegalMemo(data: ExportData): Promise<Buffer> {
  const templatePath = path.join(
    process.cwd(),
    'templates',
    'legal-memo-carbone.docx'
  );

  let basicFacts = data.basicFacts || data.factInput;
  let legalOpinion = data.legalOpinion || data.content;
  let recommendations = data.recommendations || '以上意见仅供参考。';

  // 向后兼容：如果内容包含 HTML 标签，提取纯文本
  if (basicFacts && /<[a-z][\s\S]*>/i.test(basicFacts)) {
    basicFacts = extractTextFromHtml(basicFacts);
  }
  if (legalOpinion && /<[a-z][\s\S]*>/i.test(legalOpinion)) {
    legalOpinion = extractTextFromHtml(legalOpinion);
  }
  if (recommendations && /<[a-z][\s\S]*>/i.test(recommendations)) {
    recommendations = extractTextFromHtml(recommendations);
  }

  const normalizeText = (text: string): string => {
    if (!text) return '';
    return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  };

  const carboneData = {
    client_name: data.clientName || getDefaultClientName(),
    case_title: data.caseTitle || data.title,
    law_firm: data.lawFirm || getLawFirmName(),
    basic_facts: normalizeText(basicFacts),
    legal_opinion: normalizeText(legalOpinion),
    recommendations: normalizeText(recommendations),
    date: data.chineseDate || (data.createdAt
      ? new Date(data.createdAt).toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : new Date().toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })),
  };

  console.log('📄 Exporting legal memo:');
  console.log('  - Client:', carboneData.client_name);
  console.log('  - Case:', carboneData.case_title);
  console.log('  - Basic facts length:', carboneData.basic_facts.length);
  console.log('  - Legal opinion length:', carboneData.legal_opinion.length);

  try {
    const result = await carboneRender(templatePath, carboneData);
    console.log('✅ Carbone render done, buffer size:', result.length);

    const finalBuffer = postProcessDocxParagraphs(result as Buffer);
    console.log('✅ Post-processing done, final size:', finalBuffer.length);

    return finalBuffer;
  } catch (error: any) {
    console.error('Legal memo export error:', error);
    throw new Error(`Failed to export legal memo: ${error.message}`);
  }
}

/**
 * 后处理 DOCX：将段落内连续的 <w:br/> 转换为独立的 <w:p> 段落
 * 这样每个段落都能继承模板的首行缩进等格式
 */
function postProcessDocxParagraphs(buffer: Buffer): Buffer {
  try {
    const zip = new PizZip(buffer);
    const docXml = zip.file('word/document.xml')?.asText();
    if (!docXml) return buffer;

    const PARA_BREAK = '</w:t><w:br/><w:t></w:t><w:br/><w:t>';

    const processed = docXml.replace(
      /(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/g,
      (match, pOpen: string, pContent: string, _pClose: string) => {
        if (!pContent.includes(PARA_BREAK)) return match;

        const pPrMatch = pContent.match(/(<w:pPr>[\s\S]*?<\/w:pPr>)/);
        const pPr = pPrMatch ? pPrMatch[1] : '';

        const rPrMatch = pContent.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
        const rPr = rPrMatch ? `<w:rPr>${rPrMatch[1]}</w:rPr>` : '';

        const contentStart = pPr ? pContent.indexOf(pPr) + pPr.length : 0;
        const runContent = pContent.substring(contentStart);

        const segments = runContent.split(PARA_BREAK);

        if (segments.length <= 1) return match;

        const paragraphs = segments.map((seg, idx) => {
          let content = seg;
          if (idx > 0) {
            content = `<w:r>${rPr}<w:t xml:space="preserve">${content}`;
          }
          if (idx < segments.length - 1) {
            content = `${content}</w:t></w:r>`;
          }
          return `${pOpen}${pPr}${content}</w:p>`;
        });

        return paragraphs.join('');
      }
    );

    zip.file('word/document.xml', processed);
    return Buffer.from(zip.generate({ type: 'nodebuffer' }));
  } catch (error) {
    console.error('DOCX post-processing error:', error);
    return buffer;
  }
}
