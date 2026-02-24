import { Component, createSignal, createEffect, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { api } from '../lib/api';
import { usePolling } from '../hooks/usePolling';

const PAGE_SIZE = 20;

const statusLabels: Record<string, { text: string; color: string }> = {
  pending: { text: '等待处理', color: 'bg-slate-100 text-slate-600' },
  extracting: { text: '提取文本...', color: 'bg-blue-50 text-blue-600' },
  ocr: { text: 'OCR识别中...', color: 'bg-violet-50 text-violet-600' },
  chunking: { text: '文档切分...', color: 'bg-blue-50 text-blue-600' },
  embedding: { text: '向量化...', color: 'bg-blue-50 text-blue-600' },
  ready: { text: '就绪', color: 'bg-green-50 text-green-700' },
  error: { text: '处理失败', color: 'bg-red-50 text-red-600' },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const Library: Component = () => {
  const [documents, setDocuments] = createSignal<any[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(1);
  const [search, setSearch] = createSignal('');
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [isDragOver, setIsDragOver] = createSignal(false);
  const [isUploading, setIsUploading] = createSignal(false);
  const [uploadMessage, setUploadMessage] = createSignal('');
  let fileInputRef: HTMLInputElement | undefined;

  const totalPages = () => Math.max(1, Math.ceil(total() / PAGE_SIZE));

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError('');
      const offset = (page() - 1) * PAGE_SIZE;
      const result = await api.listLibrary(PAGE_SIZE, offset, search() || undefined);
      setDocuments(result.documents);
      setTotal(result.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load library');
    } finally {
      setLoading(false);
    }
  };

  // 轮询处理中的文件状态
  const polling = usePolling(
    async () => {
      const offset = (page() - 1) * PAGE_SIZE;
      return api.listLibrary(PAGE_SIZE, offset, search() || undefined);
    },
    {
      intervalMs: 2000,
      shouldContinue: (data: any) => {
        const docs = data?.documents || [];
        return docs.some((d: any) =>
          ['pending', 'extracting', 'ocr', 'chunking', 'embedding'].includes(d.processingStatus)
        );
      },
      onData: (data: any) => {
        setDocuments(data.documents);
        setTotal(data.total);
      },
    },
  );

  createEffect(() => {
    page();
    search();
    fetchDocuments().then(() => {
      // 如果有处理中的文件，启动轮询
      const hasProcessing = documents().some(d =>
        ['pending', 'extracting', 'ocr', 'chunking', 'embedding'].includes(d.processingStatus)
      );
      if (hasProcessing) polling.start();
    });
  });

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList) return;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'pdf' && ext !== 'docx') {
        setUploadMessage(`不支持的文件格式：${file.name}，仅支持 .pdf 和 .docx`);
        continue;
      }

      setIsUploading(true);
      setUploadMessage('');
      try {
        const result = await api.uploadToLibrary(file);
        if (result.duplicate) {
          setUploadMessage(`文件「${file.name}」已存在于文档库中`);
        }
        await fetchDocuments();
        // 启动轮询
        polling.start();
      } catch (err: any) {
        setUploadMessage(`上传失败：${err.message}`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleDelete = async (id: string, fileName: string) => {
    if (!confirm(`确定要删除「${fileName}」吗？关联此文件的文书将不再能检索其内容。`)) return;

    try {
      await api.deleteLibraryDoc(id);
      await fetchDocuments();
      // 如果删除后当前页无数据，回到上一页
      if (documents().length === 0 && page() > 1) {
        setPage(page() - 1);
      }
    } catch (err: any) {
      alert('删除失败: ' + err.message);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleUpload(e.dataTransfer?.files || null);
  };

  let searchTimer: ReturnType<typeof setTimeout>;
  const handleSearchInput = (value: string) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  };

  return (
    <div class="min-h-screen bg-slate-50">
      {/* Header */}
      <header class="bg-white border-b border-slate-200">
        <div class="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <A href="/" class="text-lg font-semibold text-slate-800 tracking-tight hover:text-slate-600 transition-colors">LexDoc</A>
            <span class="text-xs text-slate-400 border-l border-slate-200 pl-3">文档库</span>
          </div>
          <div class="flex items-center gap-4">
            <A href="/" class="text-sm text-slate-600 hover:text-slate-900 transition-colors">新建文书</A>
            <A href="/documents" class="text-sm text-slate-600 hover:text-slate-900 transition-colors">文书管理</A>
          </div>
        </div>
      </header>

      <main class="max-w-5xl mx-auto px-6 py-8">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-xl font-semibold text-slate-800">文档库</h1>
            <p class="text-sm text-slate-500 mt-1">上传并管理参考文档，新建文书时可直接选用。</p>
          </div>
          <div class="text-sm text-slate-400">{total()} 个文件</div>
        </div>

        {/* Upload zone */}
        <div
          class={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors mb-6 ${
            isDragOver()
              ? 'border-slate-400 bg-slate-50'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
          }`}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onClick={() => fileInputRef?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            multiple
            class="hidden"
            onChange={(e) => {
              handleUpload(e.currentTarget.files);
              e.currentTarget.value = '';
            }}
          />
          <Show when={isUploading()} fallback={
            <>
              <svg class="mx-auto w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p class="text-xs text-slate-500">点击或拖拽上传文档到文档库</p>
              <p class="text-xs text-slate-400 mt-1">支持 .pdf .docx，相同文件自动去重</p>
            </>
          }>
            <div class="flex items-center justify-center gap-2">
              <div class="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              <span class="text-xs text-slate-500">上传中...</span>
            </div>
          </Show>
        </div>

        <Show when={uploadMessage()}>
          <div class="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-md">
            {uploadMessage()}
          </div>
        </Show>

        {/* Search */}
        <div class="mb-4">
          <input
            type="text"
            placeholder="搜索文件名..."
            onInput={(e) => handleSearchInput(e.currentTarget.value)}
            class="w-full max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
          />
        </div>

        {/* Document list */}
        <Show when={!loading() || documents().length > 0} fallback={
          <div class="text-center py-12 text-sm text-slate-400">加载中...</div>
        }>
          <Show when={error()}>
            <div class="text-center py-8 text-sm text-red-500">{error()}</div>
          </Show>

          <Show when={documents().length > 0} fallback={
            <div class="text-center py-12">
              <p class="text-sm text-slate-400">文档库为空</p>
              <p class="text-xs text-slate-400 mt-1">上传 PDF 或 DOCX 文件开始使用</p>
            </div>
          }>
            <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-slate-100 text-left">
                    <th class="px-4 py-3 text-xs font-medium text-slate-500">文件名</th>
                    <th class="px-4 py-3 text-xs font-medium text-slate-500 w-20">类型</th>
                    <th class="px-4 py-3 text-xs font-medium text-slate-500 w-24">大小</th>
                    <th class="px-4 py-3 text-xs font-medium text-slate-500 w-28">状态</th>
                    <th class="px-4 py-3 text-xs font-medium text-slate-500 w-20">片段</th>
                    <th class="px-4 py-3 text-xs font-medium text-slate-500 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  <For each={documents()}>
                    {(doc) => {
                      const status = statusLabels[doc.processingStatus] || statusLabels.pending;
                      const isProcessing = ['pending', 'extracting', 'ocr', 'chunking', 'embedding'].includes(doc.processingStatus);

                      return (
                        <tr class="border-b border-slate-50 hover:bg-slate-50/50 group">
                          <td class="px-4 py-3">
                            <div class="text-slate-700 truncate max-w-md" title={doc.originalFileName}>
                              {doc.originalFileName}
                            </div>
                            <Show when={doc.processingStatus === 'error' && doc.errorMessage}>
                              <div class="text-xs text-red-500 mt-0.5 truncate max-w-md">{doc.errorMessage}</div>
                            </Show>
                          </td>
                          <td class="px-4 py-3 text-slate-500 uppercase text-xs">{doc.fileType}</td>
                          <td class="px-4 py-3 text-slate-500 text-xs">{formatFileSize(doc.fileSize)}</td>
                          <td class="px-4 py-3">
                            <span class={`text-xs px-1.5 py-0.5 rounded-full ${status.color}`}>
                              {isProcessing && (
                                <span class="inline-block w-2 h-2 border border-current border-t-transparent rounded-full animate-spin mr-1 align-middle" />
                              )}
                              {status.text}
                            </span>
                          </td>
                          <td class="px-4 py-3 text-slate-500 text-xs">
                            {doc.processingStatus === 'ready' ? doc.chunkCount : '-'}
                          </td>
                          <td class="px-4 py-3">
                            <button
                              onClick={() => handleDelete(doc.id, doc.originalFileName)}
                              class="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              title="删除"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Show when={totalPages() > 1}>
              <div class="flex items-center justify-center gap-1 mt-6">
                <button
                  onClick={() => setPage(Math.max(1, page() - 1))}
                  disabled={page() === 1}
                  class="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <span class="px-3 py-1.5 text-xs text-slate-500">
                  {page()} / {totalPages()}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages(), page() + 1))}
                  disabled={page() === totalPages()}
                  class="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </Show>
          </Show>
        </Show>
      </main>
    </div>
  );
};

export default Library;
