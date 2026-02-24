import { Component, createSignal, onMount, For, Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { api } from '../lib/api';

interface Document {
  id: string;
  title: string;
  factInput: string;
  status: string;
  aiProvider: string;
  createdAt: string;
  updatedAt: string;
}

const PAGE_SIZE = 20;

const DocumentList: Component = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = createSignal<Document[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(1);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const totalPages = () => Math.max(1, Math.ceil(total() / PAGE_SIZE));

  const loadDocuments = async (p = page()) => {
    setLoading(true);
    setError(null);

    try {
      const offset = (p - 1) * PAGE_SIZE;
      const result = await api.listDocuments(PAGE_SIZE, offset);
      if (result.documents) {
        setDocuments(result.documents);
        setTotal(result.total ?? result.documents.length);
      }
    } catch (err: any) {
      console.error('Failed to load documents:', err);
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages()) return;
    setPage(p);
    loadDocuments(p);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`确定要删除「${title}」吗？此操作不可撤销。`)) {
      return;
    }

    try {
      await api.deleteDocument(id);
      // 如果删除后当前页为空且不是第一页，退回上一页
      if (documents().length === 1 && page() > 1) {
        goToPage(page() - 1);
      } else {
        loadDocuments();
      }
    } catch (err: any) {
      alert('删除失败: ' + err.message);
    }
  };

  onMount(() => {
    loadDocuments();
  });

  // 生成分页按钮的页码列表
  const pageNumbers = () => {
    const tp = totalPages();
    const cp = page();
    if (tp <= 7) {
      return Array.from({ length: tp }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [1];
    if (cp > 3) pages.push('...');
    for (let i = Math.max(2, cp - 1); i <= Math.min(tp - 1, cp + 1); i++) {
      pages.push(i);
    }
    if (cp < tp - 2) pages.push('...');
    pages.push(tp);
    return pages;
  };

  return (
    <div class="min-h-screen bg-slate-50">
      {/* 顶部导航栏 */}
      <header class="bg-white border-b border-slate-200">
        <div class="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <A href="/" class="text-lg font-semibold text-slate-800 tracking-tight hover:text-slate-600 transition-colors">
              LexDoc
            </A>
            <span class="text-xs text-slate-400 border-l border-slate-200 pl-3">文书管理</span>
          </div>
          <div class="flex items-center gap-3">
            <A href="/library" class="text-sm text-slate-600 hover:text-slate-900 transition-colors">文档库</A>
            <A
              href="/"
              class="px-4 py-1.5 text-xs bg-slate-800 text-white rounded-md hover:bg-slate-700 transition-colors"
            >
              新建文书
            </A>
          </div>
        </div>
      </header>

      <main class="max-w-5xl mx-auto px-6 py-8">
        <div class="mb-6">
          <h1 class="text-xl font-semibold text-slate-800">全部文书</h1>
        </div>

        <Show when={loading()}>
          <div class="flex items-center justify-center py-20">
            <div class="flex items-center gap-3 text-slate-500">
              <div class="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              <span class="text-sm">加载中...</span>
            </div>
          </div>
        </Show>

        <Show when={error()}>
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
            {error()}
            <button
              onClick={() => loadDocuments()}
              class="ml-3 underline hover:no-underline"
            >
              重试
            </button>
          </div>
        </Show>

        <Show when={!loading() && !error()}>
          <Show
            when={documents().length > 0}
            fallback={
              <div class="bg-white rounded-lg border border-slate-200 shadow-sm px-6 py-16 text-center">
                <p class="text-slate-500 mb-4">暂无文书记录</p>
                <A
                  href="/"
                  class="inline-block px-5 py-2 text-sm bg-slate-800 text-white rounded-md hover:bg-slate-700 transition-colors"
                >
                  创建第一份法律文书
                </A>
              </div>
            }
          >
            {/* 表格列表 */}
            <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-slate-100">
                    <th class="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">标题</th>
                    <th class="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">基础事实</th>
                    <th class="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">创建时间</th>
                    <th class="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={documents()}>
                    {(doc) => (
                      <tr
                        class="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        <td class="px-5 py-4">
                          <div class="text-sm font-medium text-slate-800">{doc.title}</div>
                          <div class="text-xs text-slate-400 mt-0.5">{doc.status}</div>
                        </td>
                        <td class="px-5 py-4 hidden md:table-cell">
                          <div class="text-sm text-slate-600 line-clamp-1 max-w-xs">{doc.factInput}</div>
                        </td>
                        <td class="px-5 py-4">
                          <div class="text-sm text-slate-500">
                            {new Date(doc.createdAt).toLocaleDateString('zh-CN')}
                          </div>
                        </td>
                        <td class="px-5 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(doc.id, doc.title);
                            }}
                            class="text-xs text-slate-400 hover:text-red-600 transition-colors"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            <div class="mt-4 flex items-center justify-between">
              <div class="text-xs text-slate-400">
                共 {total()} 份文书，第 {page()}/{totalPages()} 页
              </div>

              <Show when={totalPages() > 1}>
                <div class="flex items-center gap-1">
                  <button
                    onClick={() => goToPage(page() - 1)}
                    disabled={page() <= 1}
                    class="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    上一页
                  </button>

                  <For each={pageNumbers()}>
                    {(p) => (
                      <>
                        {p === '...' ? (
                          <span class="px-2 py-1.5 text-xs text-slate-400">...</span>
                        ) : (
                          <button
                            onClick={() => goToPage(p as number)}
                            class={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                              page() === p
                                ? 'bg-slate-800 text-white'
                                : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                            }`}
                          >
                            {p}
                          </button>
                        )}
                      </>
                    )}
                  </For>

                  <button
                    onClick={() => goToPage(page() + 1)}
                    disabled={page() >= totalPages()}
                    class="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    下一页
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        </Show>
      </main>
    </div>
  );
};

export default DocumentList;
