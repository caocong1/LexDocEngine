// API 客户端配置和工具函数

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/**
 * 带自动重试的 fetch（针对 5xx 和网络错误自动重试）
 */
async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<Response> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(input, init);
      // 5xx 服务端错误 → 重试
      if (res.status >= 500 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Request failed with ${res.status}, retrying in ${delay}ms (${attempt + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Network error, retrying in ${delay}ms (${attempt + 1}/${maxRetries}):`, err.message);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError || new Error('Request failed after retries');
}

export const api = {
  // 健康检查
  health: async () => {
    const res = await fetchWithRetry(`${API_BASE_URL}/health`);
    return res.json();
  },

  // 获取 AI Provider 列表
  getProviders: async () => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/ai/providers`);
    return res.json();
  },

  // AI 流式生成（返回 Response 用于 SSE，支持 RAG）— 不重试（流式连接）
  streamGenerate: (params: {
    factInput: string;
    sectionTitle: string;
    providerId?: string;
    additionalNotes?: string;
    documentId?: string;
  }) => {
    return fetch(`${API_BASE_URL}/api/ai/test-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
  },

  // AI 非流式生成（用于基本事实润色、律师建议等）
  generate: async (params: {
    factInput: string;
    sectionTitle: string;
    providerId?: string;
    additionalNotes?: string;
    documentId?: string;
    legalOpinion?: string;
  }): Promise<{ content: string }> => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Generation failed');
    }
    return res.json();
  },

  // AI 改写：选中文字 + 指令 → 流式返回改写结果（返回 Response 用于 SSE）— 不重试（流式连接）
  aiRewrite: (params: {
    sectionKey: string;
    selectedText: string;
    fullSectionContent: string;
    instruction: string;
    factInput: string;
    providerId?: string;
  }) => {
    return fetch(`${API_BASE_URL}/api/ai/rewrite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  // AI 生成案件标题摘要（基于事实+法律意见+律师建议）
  summarizeTitle: async (params: {
    factInput: string;
    additionalNotes?: string;
    legalOpinion?: string;
    advice?: string;
  }): Promise<{ title: string }> => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/ai/summarize-title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  // === 文书管理 API ===

  // 获取文书列表（分页，按时间倒序）
  listDocuments: async (limit = 20, offset = 0): Promise<{ documents: any[]; total: number }> => {
    const res = await fetchWithRetry(
      `${API_BASE_URL}/api/documents?limit=${limit}&offset=${offset}`
    );
    return res.json();
  },

  // 创建新文书
  createDocument: async (data: {
    title: string;
    factInput: string;
    aiProvider?: string;
    additionalNotes?: string;
    metadata?: {
      clientName?: string;
      caseTitle?: string;
      chineseDate?: string;
    };
  }) => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // 获取文书详情
  getDocument: async (id: string) => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/documents/${id}`);
    return res.json();
  },

  // 更新文书
  updateDocument: async (
    id: string,
    data: {
      title?: string;
      status?: string;
      factInput?: string;
      additionalNotes?: string;
    }
  ) => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/documents/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // 删除文书
  deleteDocument: async (id: string) => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/documents/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // 保存区块内容
  saveSectionContent: async (
    documentId: string,
    data: {
      sectionKey: string;
      contentHtml: string;
      contentJson?: any;
      generationPrompt?: string;
      aiProvider?: string;
    }
  ) => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/documents/${documentId}/sections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // 导出文书为 docx
  exportDocument: async (id: string) => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/documents/${id}/export`);
    if (!res.ok) {
      throw new Error('Export failed');
    }
    return res.blob();
  },

  // 更新文书元数据
  updateDocumentMetadata: async (
    id: string,
    metadata: {
      clientName?: string;
      caseTitle?: string;
      chineseDate?: string;
    }
  ) => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/documents/${id}/metadata`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });
    return res.json();
  },

  // === 文档库 API ===

  // 上传文件到文档库
  uploadToLibrary: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetchWithRetry(`${API_BASE_URL}/api/library/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },

  // 列出文档库（分页 + 搜索）
  listLibrary: async (limit = 20, offset = 0, search?: string): Promise<{ documents: any[]; total: number }> => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set('search', search);
    const res = await fetchWithRetry(`${API_BASE_URL}/api/library?${params}`);
    return res.json();
  },

  // 获取文档库文件详情
  getLibraryDoc: async (id: string) => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/library/${id}`);
    return res.json();
  },

  // 删除文档库文件
  deleteLibraryDoc: async (id: string) => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/library/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // === 文书-文档库关联 API ===

  // 关联文档库文件到文书
  linkLibraryDoc: async (documentId: string, libraryDocId: string) => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/documents/${documentId}/references`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ libraryDocId }),
    });
    return res.json();
  },

  // 列出文书关联的文档库文件
  listReferences: async (documentId: string) => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/documents/${documentId}/references`);
    return res.json();
  },

  // 取消关联
  unlinkLibraryDoc: async (documentId: string, libraryDocId: string) => {
    const res = await fetchWithRetry(`${API_BASE_URL}/api/documents/${documentId}/references/${libraryDocId}`, {
      method: 'DELETE',
    });
    return res.json();
  },
};
