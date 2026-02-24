# LexDocEngine - 法律AI文书生成系统

基于 Bun + SolidJS + Hono + 通义法睿 的法律文书智能生成系统，支持 RAG（检索增强生成）。

## 项目结构

```
LexDocEngine/
├── packages/
│   ├── frontend/                  # SolidJS + Vite 前端
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Home.tsx           # 新建文书（事实 + 附加说明 + 参考文档上传）
│   │   │   │   ├── DocumentEdit.tsx   # 文书编辑（分段编辑 + 实时预览）
│   │   │   │   └── DocumentList.tsx   # 文书列表
│   │   │   ├── components/
│   │   │   │   ├── SectionEditor.tsx      # 段落编辑器（支持 AI 改写）
│   │   │   │   ├── DocumentPreview.tsx    # 文书实时预览
│   │   │   │   └── FileUploadZone.tsx     # 参考文档拖拽上传组件
│   │   │   ├── hooks/
│   │   │   │   ├── useSSE.ts          # SSE 流式接收
│   │   │   │   └── usePolling.ts      # 参考文档处理状态轮询
│   │   │   └── lib/
│   │   │       ├── api.ts             # API 客户端
│   │   │       ├── documentFormatter.ts   # 文书格式化
│   │   │       └── chineseDate.ts     # 中文日期工具
│   │   └── ...
│   └── backend/                   # Bun + Hono 后端
│       ├── src/
│       │   ├── routes/
│       │   │   ├── ai.ts              # AI 生成 API（含 RAG 检索）
│       │   │   ├── documents.ts       # 文书 CRUD API
│       │   │   └── uploads.ts         # 参考文档上传 API
│       │   ├── services/
│       │   │   ├── ai/
│       │   │   │   ├── registry.ts    # AI Provider 注册中心
│       │   │   │   ├── farui.ts       # 通义法睿 Provider
│       │   │   │   └── prompts.ts     # 提示词模板（含 RAG 上下文）
│       │   │   ├── rag/
│       │   │   │   ├── textExtractor.ts   # PDF/DOCX 文本提取
│       │   │   │   ├── chunker.ts         # 文本分块（~500 tokens）
│       │   │   │   ├── embedding.ts       # DashScope 向量嵌入
│       │   │   │   ├── retriever.ts       # pgvector 相似度检索
│       │   │   │   ├── pipeline.ts        # 处理管线编排
│       │   │   │   └── tokenBudget.ts     # Token 预算分配
│       │   │   ├── document.ts        # 文书服务
│       │   │   └── docxExporter.ts    # Word 导出
│       │   ├── db/
│       │   │   ├── index.ts           # Drizzle 连接
│       │   │   ├── schema.ts          # 数据库 Schema
│       │   │   ├── customTypes.ts     # pgvector 自定义列类型
│       │   │   └── migrations/        # SQL 迁移文件
│       │   └── config/
│       │       └── rag.config.ts      # RAG 配置常量
│       ├── uploads/               # 上传文件存储目录
│       └── templates/             # Word 导出模板
├── docker-compose.yml             # PostgreSQL + pgvector
└── package.json                   # Monorepo workspace 配置
```

## 核心功能

- **AI 法律文书生成**：输入案件事实 → AI 自动生成法律意见书（基本事实、法律意见、律师建议）
- **附加说明**：可选的指导性文字（如"重点分析违约责任"），引导 AI 生成方向
- **参考文档上传（RAG）**：上传合同、判决书、法规等 PDF/DOCX 文件，AI 自动检索相关内容辅助生成
- **AI 改写**：选中段落文字，输入改写指令，AI 精准改写
- **分段编辑**：三段式编辑器，支持逐段重新生成
- **实时预览**：编辑即预览，所见即所得
- **Word 导出**：一键导出标准格式的 .docx 文件
- **SSE 流式输出**：打字机效果实时展示 AI 生成过程

## 快速开始

### 1. 前置要求

- [Bun](https://bun.sh) >= 1.3.0
- [Docker](https://www.docker.com) (用于 PostgreSQL + pgvector)

### 2. 安装依赖

```bash
bun install
```

### 3. 启动数据库

```bash
docker compose up -d
```

### 4. 配置环境变量

```bash
# 复制后端环境变量模板
cp packages/backend/.env.example packages/backend/.env

# 编辑 .env 文件，填入你的 DashScope API Key
# 在 https://dashscope.console.aliyun.com/ 获取 API Key
# DASHSCOPE_API_KEY 同时用于法睿模型调用和文本向量嵌入
```

### 5. 数据库迁移

```bash
cd packages/backend
bun run db:generate
bun run db:migrate
```

### 6. 启动开发服务器

```bash
# 启动后端 (http://localhost:3000)
cd packages/backend && bun run dev

# 启动前端 (http://localhost:5174)
cd packages/frontend && bun run dev
```

## 架构设计

### RAG 检索增强生成流程

```
用户上传参考文档 (PDF/DOCX)
        ↓
    文本提取 (pdf-parse / mammoth)
        ↓
    文本分块 (~500 tokens, 50 tokens 重叠)
        ↓
    向量嵌入 (DashScope text-embedding-v3, 1024维)
        ↓
    存储到 pgvector (document_chunks 表)
        ↓
  生成时: factInput + additionalNotes → 查询向量
        ↓
    余弦相似度检索 top-8, 过滤 similarity < 0.3
        ↓
    Token 预算分配 → 选取 top-5 块纳入 prompt
        ↓
    AI 生成法律意见（含参考资料上下文）
```

### Token 预算分配（farui-plus 12k 输入限制）

| 用途 | 预算 |
|------|------|
| 系统提示词 | ~800 |
| Prompt 结构 | ~500 |
| 基础事实（优先级最高） | ≤ 3000 |
| 附加说明 | ≤ 1000 |
| 参考文档检索片段 | ≤ 5000 |
| 前序章节上下文 | ~1700 |

### 数据库 Schema

```
document_instances       # 文书实例
├── section_contents     # 文书段落内容
├── reference_documents  # 参考文档记录（CASCADE 删除）
│   └── document_chunks  # 文本块 + 向量嵌入（CASCADE 删除）
└── document_templates   # 文书模板
```

关键表：
- `reference_documents`: 存储上传的参考文档元信息，跟踪处理状态 (pending → extracting → chunking → embedding → ready/error)
- `document_chunks`: 文本分块 + `vector(1024)` 向量列，使用 HNSW 索引加速相似度搜索

## API 端点

### 后端 API (http://localhost:3000)

#### 基础
- `GET /health` - 健康检查

#### AI 生成
- `GET /api/ai/providers` - 获取可用的 AI Provider 列表
- `POST /api/ai/test-generate` - AI 流式生成（SSE），支持 RAG 检索
  ```json
  {
    "factInput": "案件事实描述...",
    "sectionTitle": "法律意见",
    "providerId": "farui-plus",
    "additionalNotes": "重点分析违约责任",
    "documentId": "uuid（有值时触发 RAG 检索）"
  }
  ```
- `POST /api/ai/rewrite` - AI 改写选中文字（SSE）
- `POST /api/ai/summarize-title` - AI 生成案件标题摘要

#### 文书管理
- `GET /api/documents` - 文书列表
- `POST /api/documents` - 创建文书
- `GET /api/documents/:id` - 文书详情（含参考文档列表）
- `PUT /api/documents/:id` - 更新文书（含 additionalNotes）
- `DELETE /api/documents/:id` - 删除文书（级联删除参考文档和 chunks）
- `POST /api/documents/:id/sections` - 保存段落内容
- `PUT /api/documents/:id/metadata` - 更新元数据
- `GET /api/documents/:id/export` - 导出 Word

#### 参考文档
- `POST /api/documents/:id/references` - 上传参考文档（multipart/form-data, 支持 .pdf/.docx, 最大 20MB, 每文书最多 10 个）
- `GET /api/documents/:id/references` - 列出参考文档
- `GET /api/documents/:id/references/:refId` - 查询处理状态
- `DELETE /api/documents/:id/references/:refId` - 删除参考文档

## 技术栈

### 前端
- **SolidJS** - 响应式 UI 框架
- **Vite** - 构建工具
- **TailwindCSS** - CSS 框架

### 后端
- **Bun** - JavaScript 运行时
- **Hono** - 轻量级 Web 框架
- **Drizzle ORM** - TypeScript ORM
- **PostgreSQL + pgvector** - 关系数据库 + 向量搜索
- **OpenAI SDK** - 通义法睿 API 调用（OpenAI 兼容端点）

### AI / RAG
- **通义法睿 (farui-plus)** - 阿里云 DashScope 法律领域大模型
- **text-embedding-v3** - DashScope 文本向量嵌入模型（1024 维）
- **pgvector** - PostgreSQL 向量搜索扩展（HNSW 索引, 余弦距离）
- **pdf-parse** - PDF 文本提取
- **mammoth** - DOCX 文本提取

## 开发指南

详细的技术设计文档请参考：[legal-ai-doc-generator-spec.md](./legal-ai-doc-generator-spec.md)

## License

MIT
