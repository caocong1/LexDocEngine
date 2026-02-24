import { Component, createSignal, For, Show } from 'solid-js';
import { api } from '../lib/api';

export interface SelectedLibraryDoc {
  id: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  processingStatus: string;
  chunkCount?: number | null;
}

interface LibraryPickerProps {
  selected: SelectedLibraryDoc[];
  onSelect: (doc: SelectedLibraryDoc) => void;
  onRemove: (docId: string) => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const LibraryPicker: Component<LibraryPickerProps> = (props) => {
  const [showPanel, setShowPanel] = createSignal(false);
  const [libraryDocs, setLibraryDocs] = createSignal<any[]>([]);
  const [search, setSearch] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const selectedIds = () => new Set(props.selected.map(d => d.id));

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      const result = await api.listLibrary(50, 0, search() || undefined);
      // 只显示 ready 状态的文件
      setLibraryDocs(result.documents.filter((d: any) => d.processingStatus === 'ready'));
    } catch (err) {
      console.error('Failed to fetch library:', err);
    } finally {
      setLoading(false);
    }
  };

  const openPanel = () => {
    setShowPanel(true);
    fetchLibrary();
  };

  const toggleSelect = (doc: any) => {
    if (selectedIds().has(doc.id)) {
      props.onRemove(doc.id);
    } else {
      props.onSelect({
        id: doc.id,
        originalFileName: doc.originalFileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        processingStatus: doc.processingStatus,
        chunkCount: doc.chunkCount,
      });
    }
  };

  let searchTimer: ReturnType<typeof setTimeout>;
  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(fetchLibrary, 300);
  };

  return (
    <div>
      {/* Selected files list */}
      <Show when={props.selected.length > 0}>
        <div class="space-y-2 mb-3">
          <For each={props.selected}>
            {(doc) => (
              <div class="flex items-center gap-3 px-3 py-2 bg-white border border-slate-100 rounded-md group">
                <div class="flex-shrink-0">
                  <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-slate-700 truncate">{doc.originalFileName}</div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs text-slate-400">{formatFileSize(doc.fileSize)}</span>
                    <Show when={doc.chunkCount}>
                      <span class="text-xs text-slate-400">{doc.chunkCount} 个片段</span>
                    </Show>
                  </div>
                </div>
                <button
                  onClick={() => props.onRemove(doc.id)}
                  disabled={props.disabled}
                  class="flex-shrink-0 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-0"
                  title="移除"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Add button */}
      <button
        onClick={openPanel}
        disabled={props.disabled}
        class="w-full border-2 border-dashed border-slate-200 rounded-lg py-3 text-xs text-slate-500 hover:border-slate-300 hover:bg-slate-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        + 从文档库选择参考文档
      </button>

      {/* Selection panel (overlay) */}
      <Show when={showPanel()}>
        <div class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowPanel(false)}>
          <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 class="text-sm font-medium text-slate-800">选择参考文档</h3>
              <button onClick={() => setShowPanel(false)} class="text-slate-400 hover:text-slate-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div class="px-5 py-3 border-b border-slate-50">
              <input
                type="text"
                placeholder="搜索文件名..."
                value={search()}
                onInput={(e) => handleSearch(e.currentTarget.value)}
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            {/* List */}
            <div class="flex-1 overflow-y-auto px-2 py-2">
              <Show when={!loading()} fallback={
                <div class="text-center py-8 text-xs text-slate-400">加载中...</div>
              }>
                <Show when={libraryDocs().length > 0} fallback={
                  <div class="text-center py-8">
                    <p class="text-xs text-slate-400">文档库中暂无就绪的文档</p>
                    <p class="text-xs text-slate-400 mt-1">请先在文档库页面上传文件</p>
                  </div>
                }>
                  <For each={libraryDocs()}>
                    {(doc) => {
                      const isSelected = () => selectedIds().has(doc.id);
                      return (
                        <button
                          class={`w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 transition-colors ${
                            isSelected() ? 'bg-slate-100' : 'hover:bg-slate-50'
                          }`}
                          onClick={() => toggleSelect(doc)}
                        >
                          <div class={`flex-shrink-0 w-4 h-4 rounded border ${
                            isSelected()
                              ? 'bg-slate-700 border-slate-700'
                              : 'border-slate-300'
                          } flex items-center justify-center`}>
                            <Show when={isSelected()}>
                              <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                              </svg>
                            </Show>
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="text-xs text-slate-700 truncate">{doc.originalFileName}</div>
                            <div class="text-xs text-slate-400 mt-0.5">
                              {formatFileSize(doc.fileSize)} · {doc.chunkCount} 个片段
                            </div>
                          </div>
                        </button>
                      );
                    }}
                  </For>
                </Show>
              </Show>
            </div>

            {/* Footer */}
            <div class="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <span class="text-xs text-slate-400">已选 {props.selected.length} 个文档</span>
              <button
                onClick={() => setShowPanel(false)}
                class="px-4 py-1.5 bg-slate-800 text-white text-xs rounded-md hover:bg-slate-700 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default LibraryPicker;
