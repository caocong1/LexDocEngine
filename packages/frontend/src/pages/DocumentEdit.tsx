import { Component, createSignal, createEffect, Show, For, onMount } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import SectionEditor from '../components/SectionEditor';
import DocumentPreview from '../components/DocumentPreview';
import { api } from '../lib/api';
import { useSSE } from '../hooks/useSSE';
import { formatLegalMemo } from '../lib/documentFormatter';
import { formatChineseDate } from '../lib/chineseDate';

/**
 * 从可能包含 HTML 的内容中提取纯文本
 * 用于向后兼容旧数据（Tiptap 编辑器保存的 HTML）
 */
function stripHtmlIfNeeded(content: string): string {
  if (!content) return '';
  // 如果不包含 HTML 标签，直接返回
  if (!/<[a-z][\s\S]*>/i.test(content)) return content;
  // 简单的 HTML 标签剥离
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const DocumentEdit: Component = () => {
  const params = useParams();
  const navigate = useNavigate();

  // 文档数据
  const [document, setDocument] = createSignal<any>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);

  // 元数据字段
  const [clientName, setClientName] = createSignal('');
  const [caseTitle, setCaseTitle] = createSignal('');
  const [chineseDate, setChineseDate] = createSignal(formatChineseDate(new Date()));

  // 附加说明 & 参考文档
  const [additionalNotes, setAdditionalNotes] = createSignal('');
  const [references, setReferences] = createSignal<any[]>([]);

  // 各段落内容（纯文本）
  const [basicFacts, setBasicFacts] = createSignal('');
  const [legalOpinion, setLegalOpinion] = createSignal('');
  const [recommendations, setRecommendations] = createSignal('');

  // 预览 HTML
  const [previewHtml, setPreviewHtml] = createSignal('');

  // AI 流式生成状态
  const regenerateSSE = useSSE();
  const rewriteSSE = useSSE();
  const [streamingSection, setStreamingSection] = createSignal<string | null>(null);
  const [rewritingSection, setRewritingSection] = createSignal<string | null>(null);
  const [rewriteTarget, setRewriteTarget] = createSignal<{ selectedText: string; sectionKey: string } | null>(null);

  // 当任意内容变化时，重新生成预览（带 debounce）
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  createEffect(() => {
    const facts = basicFacts();
    const opinion = legalOpinion();
    const recs = recommendations();
    const client = clientName();
    const title = caseTitle();
    const date = chineseDate();
    const doc = document();

    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const formatted = formatLegalMemo(
        {
          clientName: client || '委托方',
          caseTitle: title || doc?.title || '',
          chineseDate: date,
        },
        {
          basicFacts: facts,
          legalOpinion: opinion,
          recommendations: recs,
        }
      );
      setPreviewHtml(formatted);
    }, 200);
  });

  // 流式生成时实时更新对应 section
  createEffect(() => {
    const section = streamingSection();
    const content = regenerateSSE.content();
    if (section && content !== undefined) {
      if (section === '基本事实') setBasicFacts(content);
      else if (section === '法律意见') setLegalOpinion(content);
      else if (section === '律师建议') setRecommendations(content);
    }
  });

  // AI 改写完成后替换选中文字
  createEffect(() => {
    const isStreaming = rewriteSSE.isStreaming();
    const target = rewriteTarget();
    if (!isStreaming && target && rewriteSSE.content()) {
      const newText = rewriteSSE.content();
      const getter = target.sectionKey === '基本事实' ? basicFacts
        : target.sectionKey === '法律意见' ? legalOpinion
        : recommendations;
      const setter = target.sectionKey === '基本事实' ? setBasicFacts
        : target.sectionKey === '法律意见' ? setLegalOpinion
        : setRecommendations;

      setter(getter().replace(target.selectedText, newText));
      setRewriteTarget(null);
      setRewritingSection(null);
      rewriteSSE.reset();
    }
  });

  // 加载文档数据
  onMount(async () => {
    if (!params.id) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await api.getDocument(params.id);
      if (result.document) {
        setDocument(result.document);

        // 加载元数据
        const metadata = result.document.metadata || {};
        setClientName(metadata.clientName || '');
        setCaseTitle(metadata.caseTitle || '');
        setChineseDate(metadata.chineseDate || formatChineseDate(new Date()));

        // 加载附加说明 & 参考文档
        setAdditionalNotes(result.document.additionalNotes || '');
        setReferences(result.document.references || []);

        // 加载各 section
        const sections = result.document.sections || [];

        const factsSection = sections.find((s: any) => s.sectionKey === '基本事实');
        setBasicFacts(factsSection
          ? stripHtmlIfNeeded(factsSection.contentHtml)
          : result.document.factInput || ''
        );

        const opinionSection = sections.find((s: any) => s.sectionKey === '法律意见');
        setLegalOpinion(opinionSection
          ? stripHtmlIfNeeded(opinionSection.contentHtml)
          : ''
        );

        const recsSection = sections.find((s: any) => s.sectionKey === '律师建议');
        setRecommendations(recsSection
          ? stripHtmlIfNeeded(recsSection.contentHtml)
          : '以上意见仅供参考。'
        );
      }
    } catch (err: any) {
      console.error('Load document error:', err);
      alert('加载文档失败: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  });

  // 保存
  const handleSave = async () => {
    if (!params.id) return;
    setIsSaving(true);

    try {
      // 保存元数据 & 附加说明
      await Promise.all([
        api.updateDocumentMetadata(params.id, {
          clientName: clientName(),
          caseTitle: caseTitle(),
          chineseDate: chineseDate(),
        }),
        api.updateDocument(params.id, {
          additionalNotes: additionalNotes(),
        }),
      ]);

      // 并行保存三个 section
      await Promise.all([
        api.saveSectionContent(params.id, {
          sectionKey: '基本事实',
          contentHtml: basicFacts(),
          contentJson: {},
          aiProvider: 'user',
        }),
        api.saveSectionContent(params.id, {
          sectionKey: '法律意见',
          contentHtml: legalOpinion(),
          contentJson: {},
          aiProvider: 'user',
        }),
        api.saveSectionContent(params.id, {
          sectionKey: '律师建议',
          contentHtml: recommendations(),
          contentJson: {},
          aiProvider: 'user',
        }),
      ]);

      alert('保存成功');
    } catch (err: any) {
      console.error('Save error:', err);
      alert('保存失败: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 导出 Word
  const handleExport = async () => {
    if (!params.id) return;
    setIsExporting(true);

    try {
      // 先保存最新内容再导出
      await api.updateDocumentMetadata(params.id, {
        clientName: clientName(),
        caseTitle: caseTitle(),
        chineseDate: chineseDate(),
      });
      await Promise.all([
        api.saveSectionContent(params.id, {
          sectionKey: '基本事实',
          contentHtml: basicFacts(),
          contentJson: {},
          aiProvider: 'user',
        }),
        api.saveSectionContent(params.id, {
          sectionKey: '法律意见',
          contentHtml: legalOpinion(),
          contentJson: {},
          aiProvider: 'user',
        }),
        api.saveSectionContent(params.id, {
          sectionKey: '律师建议',
          contentHtml: recommendations(),
          contentJson: {},
          aiProvider: 'user',
        }),
      ]);

      const blob = await api.exportDocument(params.id);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document()?.title || '法律意见'}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export error:', err);
      alert('导出失败: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // 整段重新生成
  const handleRegenerate = async (sectionKey: string) => {
    if (!confirm(`确定要重新生成「${sectionKey}」吗？当前内容将被替换。`)) return;

    // 律师建议：用非流式接口，传入法律意见作为上下文
    if (sectionKey === '律师建议') {
      setStreamingSection(sectionKey);
      setRecommendations('');
      try {
        const result = await api.generate({
          factInput: document()?.factInput || basicFacts(),
          sectionTitle: '律师建议',
          additionalNotes: additionalNotes() || undefined,
          legalOpinion: legalOpinion() || undefined,
        });
        setRecommendations(result.content);
      } catch (err: any) {
        console.error('Regenerate error:', err);
        alert('重新生成失败: ' + err.message);
      } finally {
        setStreamingSection(null);
      }
      return;
    }

    regenerateSSE.reset();
    setStreamingSection(sectionKey);

    // 清空当前 section
    if (sectionKey === '基本事实') setBasicFacts('');
    else if (sectionKey === '法律意见') setLegalOpinion('');

    try {
      const response = await api.streamGenerate({
        factInput: document()?.factInput || basicFacts(),
        sectionTitle: sectionKey,
        additionalNotes: additionalNotes() || undefined,
        documentId: params.id,
      });

      await regenerateSSE.startStream(response);
    } catch (err: any) {
      console.error('Regenerate error:', err);
      alert('重新生成失败: ' + err.message);
    } finally {
      setStreamingSection(null);
    }
  };

  // AI 改写
  const handleAIRewrite = async (sectionKey: string, selectedText: string, instruction: string) => {
    rewriteSSE.reset();
    setRewritingSection(sectionKey);

    const getter = sectionKey === '基本事实' ? basicFacts
      : sectionKey === '法律意见' ? legalOpinion
      : recommendations;

    setRewriteTarget({ selectedText, sectionKey });

    try {
      const response = await api.aiRewrite({
        sectionKey,
        selectedText,
        fullSectionContent: getter(),
        instruction,
        factInput: document()?.factInput || basicFacts(),
      });

      await rewriteSSE.startStream(response);
    } catch (err: any) {
      console.error('AI rewrite error:', err);
      alert('AI 改写失败: ' + err.message);
      setRewriteTarget(null);
      setRewritingSection(null);
    }
  };

  const isAnyStreaming = () => !!streamingSection() || !!rewritingSection();

  return (
    <div class="min-h-screen bg-slate-50">
      {/* 顶部导航栏 */}
      <header class="bg-white border-b border-slate-200">
        <div class="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              onClick={() => navigate('/documents')}
              class="text-sm text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7" />
              </svg>
              返回列表
            </button>
            <span class="text-slate-300">|</span>
            <span class="text-sm text-slate-700 font-medium truncate max-w-md">
              {document()?.title || '加载中...'}
            </span>
          </div>

          <div class="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving() || isAnyStreaming()}
              class="px-4 py-1.5 text-xs bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving() ? '保存中...' : '保存'}
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting() || isAnyStreaming()}
              class="px-4 py-1.5 text-xs bg-slate-800 text-white rounded-md hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting() ? '导出中...' : '导出 Word'}
            </button>
          </div>
        </div>
      </header>

      {/* Loading */}
      <Show when={isLoading()}>
        <div class="flex items-center justify-center py-24">
          <div class="flex items-center gap-3 text-slate-500">
            <div class="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            <span class="text-sm">加载中...</span>
          </div>
        </div>
      </Show>

      {/* 主内容区 */}
      <Show when={!isLoading() && document()}>
        <div class="max-w-[1600px] mx-auto px-6 py-6">
          <div class="flex gap-6">
            {/* 左侧：分段编辑面板 */}
            <div class="w-1/2 flex-shrink-0 space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
              {/* 委托信息 */}
              <div class="bg-white rounded-lg border border-slate-200 shadow-sm">
                <div class="px-5 py-3 border-b border-slate-100">
                  <h3 class="text-sm font-medium text-slate-700">委托信息</h3>
                </div>
                <div class="p-5 space-y-3">
                  <div>
                    <label class="block text-xs text-slate-500 mb-1">委托方</label>
                    <input
                      type="text"
                      value={clientName()}
                      onInput={(e) => setClientName(e.currentTarget.value)}
                      class="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-colors"
                      placeholder="委托方名称"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-500 mb-1">案件标题</label>
                    <input
                      type="text"
                      value={caseTitle()}
                      onInput={(e) => setCaseTitle(e.currentTarget.value)}
                      class="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-colors"
                      placeholder="案件标题"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-500 mb-1">日期</label>
                    <input
                      type="text"
                      value={chineseDate()}
                      onInput={(e) => setChineseDate(e.currentTarget.value)}
                      class="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-colors"
                      placeholder="中文日期"
                    />
                  </div>
                </div>
              </div>

              {/* 附加说明 */}
              <div class="bg-white rounded-lg border border-slate-200 shadow-sm">
                <div class="px-5 py-3 border-b border-slate-100">
                  <h3 class="text-sm font-medium text-slate-700">附加说明</h3>
                </div>
                <div class="p-5">
                  <textarea
                    value={additionalNotes()}
                    onInput={(e) => setAdditionalNotes(e.currentTarget.value)}
                    rows={3}
                    class="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-colors resize-y"
                    placeholder="输入附加说明或特殊要求，如「重点分析违约责任」..."
                  />
                </div>
              </div>

              {/* 参考文档 */}
              <Show when={references().length > 0}>
                <div class="bg-white rounded-lg border border-slate-200 shadow-sm">
                  <div class="px-5 py-3 border-b border-slate-100">
                    <h3 class="text-sm font-medium text-slate-700">参考文档</h3>
                  </div>
                  <div class="p-5 space-y-2">
                    <For each={references()}>
                      {(ref) => (
                        <div class="flex items-center justify-between text-sm px-3 py-2 bg-slate-50 rounded border border-slate-100">
                          <div class="flex items-center gap-2 min-w-0">
                            <span class="text-slate-400 flex-shrink-0">
                              {ref.fileType === 'pdf' ? (
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                              ) : (
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                              )}
                            </span>
                            <span class="truncate text-slate-700">{ref.originalFileName}</span>
                          </div>
                          <span class={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                            ref.processingStatus === 'ready'
                              ? 'bg-green-50 text-green-600'
                              : ref.processingStatus === 'error'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-amber-50 text-amber-600'
                          }`}>
                            {ref.processingStatus === 'ready' ? `就绪 (${ref.chunkCount} 块)` :
                             ref.processingStatus === 'error' ? '失败' :
                             ref.processingStatus === 'pending' ? '等待中' :
                             ref.processingStatus === 'ocr' ? 'OCR识别中' :
                             '处理中'}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* 基本事实 */}
              <SectionEditor
                label="一、基本事实"
                sectionKey="基本事实"
                value={basicFacts()}
                onChange={setBasicFacts}
                rows={8}
                showRegenerate={false}
                showAIRewrite={true}
                isStreaming={streamingSection() === '基本事实' || rewritingSection() === '基本事实'}
                onAIRewrite={(selectedText, instruction) => handleAIRewrite('基本事实', selectedText, instruction)}
              />

              {/* 法律意见 */}
              <SectionEditor
                label="二、法律意见"
                sectionKey="法律意见"
                value={legalOpinion()}
                onChange={setLegalOpinion}
                rows={16}
                showRegenerate={true}
                showAIRewrite={true}
                isStreaming={streamingSection() === '法律意见' || rewritingSection() === '法律意见'}
                onRegenerate={() => handleRegenerate('法律意见')}
                onAIRewrite={(selectedText, instruction) => handleAIRewrite('法律意见', selectedText, instruction)}
              />

              {/* 律师建议 */}
              <SectionEditor
                label="三、律师建议"
                sectionKey="律师建议"
                value={recommendations()}
                onChange={setRecommendations}
                rows={6}
                showRegenerate={true}
                showAIRewrite={true}
                isStreaming={streamingSection() === '律师建议' || rewritingSection() === '律师建议'}
                onRegenerate={() => handleRegenerate('律师建议')}
                onAIRewrite={(selectedText, instruction) => handleAIRewrite('律师建议', selectedText, instruction)}
              />

              {/* 文档信息 */}
              <div class="text-xs text-slate-400 px-2 pb-4 space-y-1">
                <div>创建于 {document()?.createdAt ? new Date(document()!.createdAt).toLocaleString('zh-CN') : '-'}</div>
              </div>
            </div>

            {/* 右侧：文档预览 */}
            <div class="w-1/2 sticky top-6 self-start">
              <DocumentPreview html={previewHtml()} />
            </div>
          </div>
        </div>
      </Show>

      {/* 文档不存在 */}
      <Show when={!isLoading() && !document()}>
        <div class="flex flex-col items-center justify-center py-24">
          <p class="text-slate-500 mb-4">文档不存在或已被删除</p>
          <button
            onClick={() => navigate('/documents')}
            class="px-4 py-2 text-sm bg-slate-800 text-white rounded-md hover:bg-slate-700 transition-colors"
          >
            返回文书列表
          </button>
        </div>
      </Show>
    </div>
  );
};

export default DocumentEdit;
