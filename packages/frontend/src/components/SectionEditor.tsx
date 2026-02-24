import { Component, createSignal, Show, onCleanup } from 'solid-js';

export interface SectionEditorProps {
  label: string;
  sectionKey: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  onAIRewrite?: (selectedText: string, instruction: string) => void;
  showRegenerate?: boolean;
  showAIRewrite?: boolean;
}

const SectionEditor: Component<SectionEditorProps> = (props) => {
  let textareaRef: HTMLTextAreaElement | undefined;

  const [selectedText, setSelectedText] = createSignal('');
  const [showRewritePopup, setShowRewritePopup] = createSignal(false);
  const [rewriteInstruction, setRewriteInstruction] = createSignal('');
  const [popupPosition, setPopupPosition] = createSignal({ top: 0, left: 0 });

  const handleSelect = () => {
    if (!textareaRef || !props.showAIRewrite) return;

    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;

    if (start !== end) {
      const text = props.value.substring(start, end);
      setSelectedText(text);

      // 计算浮动按钮位置
      const rect = textareaRef.getBoundingClientRect();
      setPopupPosition({
        top: -40,
        left: rect.width / 2 - 40,
      });
    } else {
      setSelectedText('');
    }
  };

  const handleRewriteSubmit = () => {
    const instruction = rewriteInstruction().trim();
    if (!instruction || !selectedText()) return;

    props.onAIRewrite?.(selectedText(), instruction);

    // 重置状态
    setShowRewritePopup(false);
    setRewriteInstruction('');
    setSelectedText('');
  };

  const handleRewriteCancel = () => {
    setShowRewritePopup(false);
    setRewriteInstruction('');
  };

  // 键盘快捷键：Escape 关闭改写面板
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && showRewritePopup()) {
      handleRewriteCancel();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
  }

  return (
    <div class="bg-white rounded-lg border border-slate-200 shadow-sm">
      {/* 标题栏 */}
      <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 class="text-sm font-medium text-slate-700">{props.label}</h3>
        <div class="flex items-center gap-2">
          <Show when={props.showRegenerate && props.onRegenerate}>
            <button
              onClick={() => props.onRegenerate?.()}
              disabled={props.isStreaming}
              class="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              重新生成
            </button>
          </Show>
        </div>
      </div>

      {/* 编辑区域 */}
      <div class="relative">
        <textarea
          ref={textareaRef}
          value={props.value}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          onMouseUp={handleSelect}
          onSelect={handleSelect}
          rows={props.rows || 8}
          disabled={props.isStreaming}
          class="w-full px-5 py-4 text-sm leading-relaxed border-0 focus:outline-none focus:ring-0 resize-y disabled:bg-slate-50 disabled:text-slate-500"
          placeholder={props.placeholder || `请输入${props.label}内容...`}
          style={{ "min-height": `${(props.rows || 8) * 1.5}em` }}
        />

        {/* 选中文字后的浮动 AI 改写按钮 */}
        <Show when={props.showAIRewrite && selectedText() && !showRewritePopup() && !props.isStreaming}>
          <div
            class="absolute z-10"
            style={{
              top: `${popupPosition().top}px`,
              left: `${popupPosition().left}px`,
            }}
          >
            <button
              onClick={() => setShowRewritePopup(true)}
              class="px-3 py-1.5 text-xs bg-slate-800 text-white rounded-md shadow-lg hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              AI 改写
            </button>
          </div>
        </Show>

        {/* AI 改写指令输入面板 */}
        <Show when={showRewritePopup()}>
          <div class="mx-5 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span class="text-xs font-medium text-slate-600">AI 改写</span>
            </div>
            <div class="text-xs text-slate-400 mb-2 truncate">
              选中：{selectedText().substring(0, 50)}{selectedText().length > 50 ? '...' : ''}
            </div>
            <div class="flex gap-2">
              <input
                type="text"
                value={rewriteInstruction()}
                onInput={(e) => setRewriteInstruction(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRewriteSubmit();
                }}
                class="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="输入改写指令，如：语气更强硬、补充法律依据..."
                autofocus
              />
              <button
                onClick={handleRewriteSubmit}
                disabled={!rewriteInstruction().trim() || props.isStreaming}
                class="px-3 py-1.5 text-xs bg-slate-800 text-white rounded hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                改写
              </button>
              <button
                onClick={handleRewriteCancel}
                class="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </Show>
      </div>

      {/* 流式生成提示 */}
      <Show when={props.isStreaming}>
        <div class="px-5 py-2 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
          <div class="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          AI 正在生成中...
        </div>
      </Show>
    </div>
  );
};

export default SectionEditor;
