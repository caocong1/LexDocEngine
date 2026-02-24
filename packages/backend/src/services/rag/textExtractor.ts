import { ragConfig } from '../../config/rag.config';
import { ocrPdf } from './ocrExtractor';

export interface ExtractedDocument {
  text: string;
  pageCount?: number;
  metadata?: Record<string, any>;
  usedOcr?: boolean;
}

export async function extractText(filePath: string, fileType: 'pdf' | 'docx'): Promise<ExtractedDocument> {
  if (fileType === 'pdf') {
    return extractPdf(filePath);
  } else if (fileType === 'docx') {
    return extractDocx(filePath);
  }
  throw new Error(`Unsupported file type: ${fileType}`);
}

async function extractPdf(filePath: string): Promise<ExtractedDocument> {
  const mupdf = await import('mupdf');
  const buffer = await Bun.file(filePath).arrayBuffer();
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf');

  const pageCount = doc.countPages();
  const pageTexts: string[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const st = page.toStructuredText();
    pageTexts.push(st.asText());
    page.destroy();
  }

  doc.destroy();

  const text = pageTexts.join('\n').trim();
  const textDensity = text.length / Math.max(pageCount, 1);

  // 当每页平均字符数低于阈值时，判定为图片型 PDF，启用 OCR
  if (textDensity < ragConfig.ocrTextDensityThreshold) {
    console.log(`[TextExtractor] Low text density (${Math.round(textDensity)} chars/page), falling back to OCR`);
    const ocrText = await ocrPdf(filePath);
    return {
      text: ocrText,
      pageCount,
      usedOcr: true,
    };
  }

  return {
    text,
    pageCount,
    usedOcr: false,
  };
}

async function extractDocx(filePath: string): Promise<ExtractedDocument> {
  const mammoth = await import('mammoth');
  const buffer = await Bun.file(filePath).arrayBuffer();
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return {
    text: result.value,
    usedOcr: false,
  };
}
