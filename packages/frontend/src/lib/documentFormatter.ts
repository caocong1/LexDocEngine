/**
 * 文档格式化工具
 * 用于组装完整的法律备忘录结构
 */

export interface DocumentMetadata {
  clientName: string;
  caseTitle: string;
  chineseDate: string;
  lawFirm?: string;
}

export interface DocumentContent {
  basicFacts: string;
  legalOpinion: string;
  recommendations?: string;
}

/**
 * 将纯文本转换为 HTML 段落
 * - \n\n 分隔的内容视为独立段落
 * - \n 分隔的内容视为段内换行 (<br>)
 */
function textToHtml(text: string, indent: boolean = false): string {
  if (!text) return '';

  // 如果已经包含 HTML 标签，说明已经是 HTML 格式，直接返回
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text;
  }

  const style = indent
    ? 'style="text-indent: 2em; line-height: 1.8; margin-bottom: 0.5em;"'
    : 'style="line-height: 1.8; margin-bottom: 0.5em;"';

  return text
    .split(/\n\n+/)
    .map(paragraph => {
      const trimmed = paragraph.trim();
      if (!trimmed) return '';
      const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
      return `<p ${style}>${lines.join('<br>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * 格式化完整的法律备忘录文档
 * 返回 HTML 格式的完整文档
 */
export function formatLegalMemo(
  metadata: DocumentMetadata,
  content: DocumentContent
): string {
  const lawFirm = metadata.lawFirm || '国浩律师（北京）事务所';
  const recommendations = content.recommendations || '以上意见仅供参考。';

  // 使用更好的 HTML 格式，便于在编辑器中显示
  return `
<div class="legal-memo-document">
  <div class="section-header" style="text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 20px;">
    法律备忘录
  </div>

  <div class="section-opening" style="margin-bottom: 20px;">
    <p style="text-indent: 2em; line-height: 1.8;">
      敬启者：
    </p>
    <p style="text-indent: 2em; line-height: 1.8;">
      我们是${lawFirm}律师，受<strong>${metadata.clientName || '委托方'}</strong>的委托，就<strong>${metadata.caseTitle || '相关事宜'}</strong>，出具如下法律意见：
    </p>
  </div>

  <div class="section-basic-facts" style="margin-bottom: 20px;">
    <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">一、基本事实</h2>
    <div style="line-height: 1.8;">
      ${textToHtml(content.basicFacts, true)}
    </div>
  </div>

  <div class="section-legal-opinion" style="margin-bottom: 20px;">
    <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">二、法律意见</h2>
    <div style="line-height: 1.8;">
      ${textToHtml(content.legalOpinion)}
    </div>
  </div>

  <div class="section-recommendations" style="margin-bottom: 20px;">
    <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">三、律师建议</h2>
    <div style="line-height: 1.8;">
      ${textToHtml(recommendations, true)}
    </div>
  </div>

  <div class="section-closing" style="margin-top: 40px;">
    <p style="line-height: 1.8;">此致</p>
    <p style="line-height: 1.8;"><strong>${metadata.clientName || '委托方'}</strong></p>
    <p style="text-align: right; line-height: 1.8;">
      ${lawFirm}<br/>
      ${metadata.chineseDate}
    </p>
  </div>
</div>
`.trim();
}
