import { Component } from 'solid-js';

export interface DocumentPreviewProps {
  html: string;
}

const DocumentPreview: Component<DocumentPreviewProps> = (props) => {
  return (
    <div class="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 class="text-sm font-medium text-slate-700">文档预览</h2>
        <span class="text-xs text-slate-400">只读预览</span>
      </div>
      <div class="p-8 overflow-y-auto" style={{ "max-height": "calc(100vh - 10rem)" }}>
        <div
          class="document-preview mx-auto"
          innerHTML={props.html}
        />
      </div>
    </div>
  );
};

export default DocumentPreview;
