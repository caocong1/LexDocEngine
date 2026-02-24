import { ragConfig } from '../../config/rag.config';

/**
 * 图片型 PDF OCR 识别
 * 使用 mupdf 将 PDF 页面渲染为图片，调用 DashScope qwen-vl-plus 多模态模型识别文字
 */

const VL_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

const OCR_PROMPT = '请完整提取图片中的所有文字内容，保持原始格式和段落结构。只输出识别到的文字，不要添加任何解释或说明。';

/**
 * 将 PDF 各页渲染为 PNG 图片
 */
export async function renderPdfPages(filePath: string): Promise<Uint8Array[]> {
  const mupdf = await import('mupdf');
  const buffer = await Bun.file(filePath).arrayBuffer();
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');

  const pageCount = doc.countPages();
  const pages: Uint8Array[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    // 渲染为 150 DPI（缩放比例 150/72 ≈ 2.08）
    const scale = 150 / 72;
    const matrix = mupdf.Matrix.scale(scale, scale);
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
    const png = pixmap.asPNG();
    pages.push(png);

    pixmap.destroy();
    page.destroy();
  }

  doc.destroy();
  return pages;
}

/**
 * 单页图片 OCR：发送图片到 qwen-vl-plus 多模态模型识别文字
 */
export async function ocrPage(imageData: Uint8Array): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY not set');

  const base64 = Buffer.from(imageData).toString('base64');
  const dataUri = `data:image/png;base64,${base64}`;

  const response = await fetch(VL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: ragConfig.ocrModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUri } },
            { type: 'text', text: OCR_PROMPT },
          ],
        },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`qwen-vl OCR API error: ${response.status} ${error}`);
  }

  const data: any = await response.json();

  if (data.error) {
    throw new Error(`qwen-vl OCR error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * 对图片型 PDF 进行 OCR 识别
 * 渲染全部页面 → 逐页 OCR → 拼合文字
 */
export async function ocrPdf(filePath: string): Promise<string> {
  console.log(`[OCR] Rendering PDF pages: ${filePath}`);
  const pageImages = await renderPdfPages(filePath);
  console.log(`[OCR] Rendered ${pageImages.length} pages, starting OCR...`);

  const pageTexts: string[] = [];

  for (let i = 0; i < pageImages.length; i++) {
    console.log(`[OCR] Processing page ${i + 1}/${pageImages.length}...`);
    try {
      const text = await ocrPage(pageImages[i]);
      if (text) {
        pageTexts.push(text);
      }
    } catch (err: any) {
      console.warn(`[OCR] Page ${i + 1} failed: ${err.message}`);
      // 单页失败不中断整体流程
    }
  }

  const combined = pageTexts.join('\n\n');
  console.log(`[OCR] Completed: ${pageTexts.length} pages, ${combined.length} chars total`);
  return combined;
}
