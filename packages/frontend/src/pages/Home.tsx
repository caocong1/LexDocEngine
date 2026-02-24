import { Component, createSignal, Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { api } from '../lib/api';
import { formatChineseDate } from '../lib/chineseDate';
import LibraryPicker, { type SelectedLibraryDoc } from '../components/LibraryPicker';

const Home: Component = () => {
  const navigate = useNavigate();
  const [factInput, setFactInput] = createSignal('');
  const [additionalNotes, setAdditionalNotes] = createSignal('');
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [generatingStep, setGeneratingStep] = createSignal('');
  const [generateError, setGenerateError] = createSignal<string | null>(null);

  // 元数据字段
  const [clientName, setClientName] = createSignal('');
  const [caseTitle, setCaseTitle] = createSignal('');
  const [chineseDate, setChineseDate] = createSignal(formatChineseDate(new Date()));

  // 从文档库选择的参考文档
  const [selectedDocs, setSelectedDocs] = createSignal<SelectedLibraryDoc[]>([]);

  const handleSelectDoc = (doc: SelectedLibraryDoc) => {
    setSelectedDocs(prev => [...prev, doc]);
  };

  const handleRemoveDoc = (docId: string) => {
    setSelectedDocs(prev => prev.filter(d => d.id !== docId));
  };

  const handleGenerate = async () => {
    if (!factInput().trim()) {
      alert('请输入基础事实');
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setGeneratingStep('准备中...');

    try {
      // 为了 RAG 检索，需要先创建文书并关联文件
      let docId: string | undefined;
      if (selectedDocs().length > 0) {
        setGeneratingStep('创建文书并关联参考文档...');
        const now = new Date();
        const title = `法律意见_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const result = await api.createDocument({
          title,
          factInput: factInput(),
          aiProvider: 'farui-plus',
          additionalNotes: additionalNotes() || undefined,
          metadata: {
            clientName: clientName(),
            caseTitle: caseTitle(),
            chineseDate: chineseDate(),
          },
        });
        docId = result.document?.id;
        if (docId) {
          await Promise.all(
            selectedDocs().map(doc => api.linkLibraryDoc(docId!, doc.id))
          );
        }
      }

      // 1. 生成法律意见（含参考资料预处理）
      setGeneratingStep('正在分析参考资料并生成法律意见...');
      const opinionResult = await api.generate({
        factInput: factInput(),
        sectionTitle: '法律意见',
        additionalNotes: additionalNotes() || undefined,
        documentId: docId,
      });
      const legalOpinion = opinionResult.content;
      if (!legalOpinion || legalOpinion.length === 0) {
        throw new Error('法律意见生成结果为空，请重试');
      }

      // 2. 生成基本事实（润色）
      setGeneratingStep('正在润色基本事实...');
      const factsResult = await api.generate({
        factInput: factInput(),
        sectionTitle: '基本事实',
        additionalNotes: additionalNotes() || undefined,
        documentId: docId,
      }).catch(() => ({ content: factInput() }));

      // 3. 律师建议：基于法律意见上下文生成
      setGeneratingStep('正在生成律师建议...');
      const adviceResult = await api.generate({
        factInput: factInput(),
        sectionTitle: '律师建议',
        additionalNotes: additionalNotes() || undefined,
        legalOpinion,
      }).catch(() => ({ content: '以上意见仅供参考。' }));

      // 4. 标题生成放在最后，综合所有内容
      setGeneratingStep('正在生成标题...');
      if (!caseTitle().trim()) {
        try {
          const titleResult = await api.summarizeTitle({
            factInput: factInput(),
            additionalNotes: additionalNotes() || undefined,
            legalOpinion,
            advice: adviceResult.content,
          });
          if (titleResult.title) setCaseTitle(titleResult.title);
        } catch (err) {
          console.warn('Title generation failed:', err);
        }
      }

      // 5. 保存文书
      setGeneratingStep('正在保存文书...');
      if (!docId) {
        const now = new Date();
        const title = `法律意见_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const result = await api.createDocument({
          title,
          factInput: factInput(),
          aiProvider: 'farui-plus',
          additionalNotes: additionalNotes() || undefined,
          metadata: {
            clientName: clientName(),
            caseTitle: caseTitle(),
            chineseDate: chineseDate(),
          },
        });
        docId = result.document?.id;
        if (!docId) throw new Error('创建文书失败');
      } else if (caseTitle().trim()) {
        await api.updateDocumentMetadata(docId, {
          clientName: clientName(),
          caseTitle: caseTitle(),
          chineseDate: chineseDate(),
        });
      }

      await Promise.all([
        api.saveSectionContent(docId, {
          sectionKey: '法律意见',
          contentHtml: legalOpinion,
          contentJson: {},
          aiProvider: 'farui-plus',
        }),
        api.saveSectionContent(docId, {
          sectionKey: '基本事实',
          contentHtml: factsResult.content,
          contentJson: {},
          aiProvider: 'farui-plus',
        }),
        api.saveSectionContent(docId, {
          sectionKey: '律师建议',
          contentHtml: adviceResult.content,
          contentJson: {},
          aiProvider: 'farui-plus',
        }),
      ]);

      navigate(`/documents/${docId}`);
    } catch (err: any) {
      console.error('Generation error:', err);
      setGenerateError(err.message || '生成失败');
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  return (
    <div class="min-h-screen bg-slate-50">
      {/* 顶部导航栏 */}
      <header class="bg-white border-b border-slate-200">
        <div class="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-lg font-semibold text-slate-800 tracking-tight">LexDoc</span>
            <span class="text-xs text-slate-400 border-l border-slate-200 pl-3">法律文书生成</span>
          </div>
          <div class="flex items-center gap-4">
            <A href="/library" class="text-sm text-slate-600 hover:text-slate-900 transition-colors">文档库</A>
            <A href="/documents" class="text-sm text-slate-600 hover:text-slate-900 transition-colors">文书管理</A>
          </div>
        </div>
      </header>

      <main class="max-w-3xl mx-auto px-6 py-10">
        <div class="mb-8">
          <h1 class="text-2xl font-semibold text-slate-800 mb-1">新建法律意见</h1>
          <p class="text-sm text-slate-500">请填写委托信息与案件基础事实，系统将据此生成法律意见书初稿。</p>
        </div>

        <div class="bg-white rounded-lg border border-slate-200 shadow-sm">
          {/* 委托信息区 */}
          <div class="p-6 border-b border-slate-100">
            <h2 class="text-sm font-medium text-slate-700 mb-4">委托信息</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">委托方名称</label>
                <input
                  type="text"
                  value={clientName()}
                  onInput={(e) => setClientName(e.currentTarget.value)}
                  class="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-colors"
                  placeholder="例如：中翼航空投资有限公司"
                  disabled={isGenerating()}
                />
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">案件标题</label>
                <input
                  type="text"
                  value={caseTitle()}
                  onInput={(e) => setCaseTitle(e.currentTarget.value)}
                  class="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-colors"
                  placeholder="留空则自动生成"
                  disabled={isGenerating()}
                />
              </div>
            </div>
            <div class="mt-4 max-w-xs">
              <label class="block text-xs text-slate-500 mb-1.5">出具日期</label>
              <input
                type="text"
                value={chineseDate()}
                onInput={(e) => setChineseDate(e.currentTarget.value)}
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-colors"
                placeholder="二〇二六年一月十九日"
                disabled={isGenerating()}
              />
            </div>
          </div>

          {/* 基础事实区 */}
          <div class="p-6 border-b border-slate-100">
            <h2 class="text-sm font-medium text-slate-700 mb-4">基础事实</h2>
            <textarea
              value={factInput()}
              onInput={(e) => setFactInput(e.currentTarget.value)}
              rows={18}
              class="w-full px-3 py-3 text-sm leading-relaxed border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-colors resize-y"
              placeholder="请详细描述案件事实，包括当事人、事件经过、关键时间节点、涉及的法律关系等..."
              disabled={isGenerating()}
            />
          </div>

          {/* 附加说明区 */}
          <div class="p-6 border-b border-slate-100">
            <div class="flex items-center gap-2 mb-4">
              <h2 class="text-sm font-medium text-slate-700">附加说明</h2>
              <span class="text-xs text-slate-400">（可选）</span>
            </div>
            <textarea
              value={additionalNotes()}
              onInput={(e) => setAdditionalNotes(e.currentTarget.value)}
              rows={4}
              class="w-full px-3 py-3 text-sm leading-relaxed border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-colors resize-y"
              placeholder="输入附加说明或特殊要求，例如：请重点分析合同违约责任、侧重风险提示、需要引用某某法律条文..."
              disabled={isGenerating()}
            />
          </div>

          {/* 参考文档区 */}
          <div class="p-6 border-b border-slate-100">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-medium text-slate-700">参考文档</h2>
                <span class="text-xs text-slate-400">（可选）</span>
              </div>
              <A href="/library" class="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                管理文档库
              </A>
            </div>
            <p class="text-xs text-slate-400 mb-3">
              从文档库选择参考资料，AI 将结合这些文档生成更精准的法律意见。
            </p>
            <LibraryPicker
              selected={selectedDocs()}
              onSelect={handleSelectDoc}
              onRemove={handleRemoveDoc}
              disabled={isGenerating()}
            />
            <Show when={selectedDocs().length > 0}>
              <div class="mt-2 text-xs text-green-600">
                {selectedDocs().length} 个参考文档已选择，将在生成时使用
              </div>
            </Show>
          </div>

          {/* 操作区 */}
          <div class="px-6 pb-6 pt-4">
            <Show when={generateError()}>
              <div class="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
                {generateError()}
              </div>
            </Show>

            <Show when={isGenerating()}>
              <div class="mb-4 px-4 py-3 bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-md flex items-center gap-3">
                <div class="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                {generatingStep() || '生成中...'}
              </div>
            </Show>

            <button
              onClick={handleGenerate}
              disabled={isGenerating() || !factInput().trim()}
              class="w-full py-2.5 bg-slate-800 text-white text-sm font-medium rounded-md hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating() ? '生成中...' : '生成法律意见'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
