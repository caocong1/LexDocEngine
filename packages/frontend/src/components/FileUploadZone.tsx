import { Component, For, Show, createSignal } from 'solid-js';

export interface UploadedFile {
  id: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  processingStatus: string;
  errorMessage?: string | null;
  chunkCount?: number | null;
}

interface FileUploadZoneProps {
  files: UploadedFile[];
  onUpload: (file: File) => Promise<void>;
  onRemove: (fileId: string) => void;
  disabled?: boolean;
  maxFiles?: number;
}

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

const FileUploadZone: Component<FileUploadZoneProps> = (props) => {
  const [isDragOver, setIsDragOver] = createSignal(false);
  const [isUploading, setIsUploading] = createSignal(false);
  let fileInputRef: HTMLInputElement | undefined;

  const maxFiles = () => props.maxFiles || 10;
  const canUpload = () => !props.disabled && !isUploading() && props.files.length < maxFiles();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || !canUpload()) return;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'pdf' && ext !== 'docx') {
        alert(`不支持的文件格式：${file.name}，仅支持 .pdf 和 .docx`);
        continue;
      }
      if (props.files.length + i >= maxFiles()) {
        alert(`最多上传 ${maxFiles()} 个文件`);
        break;
      }

      setIsUploading(true);
      try {
        await props.onUpload(file);
      } catch (err: any) {
        alert(`上传失败：${err.message}`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer?.files || null);
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => setIsDragOver(false);

  return (
    <div>
      {/* Upload zone */}
      <Show when={canUpload()}>
        <div
          class={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragOver()
              ? 'border-slate-400 bg-slate-50'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
          }`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            multiple
            class="hidden"
            onChange={(e) => {
              handleFiles(e.currentTarget.files);
              e.currentTarget.value = '';
            }}
          />
          <Show when={isUploading()} fallback={
            <>
              <svg class="mx-auto w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p class="text-xs text-slate-500">点击或拖拽上传参考文档</p>
              <p class="text-xs text-slate-400 mt-1">支持 .pdf .docx</p>
            </>
          }>
            <div class="flex items-center justify-center gap-2">
              <div class="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              <span class="text-xs text-slate-500">上传中...</span>
            </div>
          </Show>
        </div>
      </Show>

      {/* File list */}
      <Show when={props.files.length > 0}>
        <div class="mt-3 space-y-2">
          <For each={props.files}>
            {(file) => {
              const status = statusLabels[file.processingStatus] || statusLabels.pending;
              const isProcessing = ['pending', 'extracting', 'ocr', 'chunking', 'embedding'].includes(file.processingStatus);

              return (
                <div class="flex items-center gap-3 px-3 py-2 bg-white border border-slate-100 rounded-md group">
                  {/* File icon */}
                  <div class="flex-shrink-0">
                    <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>

                  {/* File info */}
                  <div class="flex-1 min-w-0">
                    <div class="text-xs text-slate-700 truncate">{file.originalFileName}</div>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-xs text-slate-400">{formatFileSize(file.fileSize)}</span>
                      <span class={`text-xs px-1.5 py-0.5 rounded-full ${status.color}`}>
                        {isProcessing && (
                          <span class="inline-block w-2 h-2 border border-current border-t-transparent rounded-full animate-spin mr-1 align-middle" />
                        )}
                        {status.text}
                      </span>
                      <Show when={file.processingStatus === 'ready' && file.chunkCount}>
                        <span class="text-xs text-slate-400">{file.chunkCount} 个片段</span>
                      </Show>
                    </div>
                    <Show when={file.processingStatus === 'error' && file.errorMessage}>
                      <div class="text-xs text-red-500 mt-0.5 truncate">{file.errorMessage}</div>
                    </Show>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onRemove(file.id);
                    }}
                    disabled={props.disabled}
                    class="flex-shrink-0 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-0"
                    title="删除"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default FileUploadZone;
