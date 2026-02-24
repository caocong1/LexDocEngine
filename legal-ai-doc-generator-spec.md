# 法律AI文档生成系统 — 技术选型与架构设计

## 1. 项目概述

### 1.1 产品定位

面向律师的AI辅助法律文书生成工具。律师输入案件事实，系统依据预置模板和历史文档，生成完整的法律意见分析书等文书，支持段落级迭代编辑，最终导出格式规范的 docx 文件。

### 1.2 核心用户流程

```
输入事实文字 → 选择文书模板 → AI生成完整文书初稿
    ↓
浏览全文 → 选中某段落 → 输入修改提示词 → AI局部重新生成
    ↓
手动编辑微调 → 循环以上步骤直到满意
    ↓
导出与预置模板格式一致的 docx 文件 → 下载
```

### 1.3 核心技术挑战

| 挑战 | 说明 |
|------|------|
| 编辑器与docx的格式鸿沟 | Web编辑器基于HTML/JSON，docx基于OpenXML，两者非一对一映射 |
| AI生成内容的结构化 | AI输出需要按模板结构拆分为离散的区块，而非自由文本 |
| 模板格式保真 | 导出的docx必须严格匹配律所预置的模板格式（字体、间距、页眉页脚等） |
| 段落级AI交互 | 需要在编辑器中实现"选中→提示→局部重新生成"的流畅交互 |
| AI输出长度限制 | 通义法睿单次最大输出2k tokens，需合理拆分区块确保生成完整性 |

---

## 2. 整体架构

### 2.1 架构决策：前后端分离 + 编辑与导出解耦

采用**前后端分离架构**，前端SolidJS SPA + 后端Bun API服务独立部署。同时将"内容编辑"与"格式化导出"解耦为两个独立环节：

- **前端**：SolidJS SPA，承载Tiptap富文本编辑器、AI交互、内容展示
- **后端**：Bun + Hono API服务，处理AI调用、文档导出、数据持久化
- **导出阶段**：Docx模板引擎，将编辑器中的结构化内容填充到真实Word模板中，确保格式保真

前后端通过 **RESTful API + SSE（Server-Sent Events）** 通信，文档数据通过**结构化文档 Schema（JSON）**桥接。

### 2.2 系统架构图

```
┌─────────────────────────────────────────────────────┐
│                 前端 (SolidJS SPA)                     │
│               Bun + Vite 构建                          │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  事实输入面板  │  │ Tiptap 编辑器 │  │  模板选择器   │ │
│  │             │  │              │  │              │ │
│  │ - 文字输入    │  │ - 区块化编辑   │  │ - 模板列表    │ │
│  │ - 文件上传    │  │ - AI 选中重写  │  │ - 模板预览    │ │
│  │ - 历史记录    │  │ - 手动编辑     │  │ - 字段配置    │ │
│  └──────┬──────┘  │ - 流式生成展示  │  └──────┬──────┘ │
│         │         └──────┬───────┘          │        │
│         └────────────────┼──────────────────┘        │
│                          │                            │
│                   结构化 JSON                          │
└──────────────────────────┬────────────────────────────┘
                           │ HTTP API + SSE
┌──────────────────────────┼────────────────────────────┐
│                  后端 (Bun + Hono)                       │
│                          │                              │
│  ┌───────────────────────┼───────────────────────────┐ │
│  │              API Gateway / Router (Hono)           │ │
│  └───────┬───────────────┼──────────────┬────────────┘ │
│          │               │              │              │
│  ┌───────▼──────┐ ┌──────▼──────┐ ┌────▼───────────┐ │
│  │  AI 生成服务   │ │ 文档导出服务  │ │  模板管理服务   │ │
│  │              │ │             │ │               │ │
│  │ - Prompt编排  │ │ - 模板解析   │ │ - 模板CRUD    │ │
│  │ - 流式输出    │ │ - 内容填充   │ │ - 字段定义    │ │
│  │ - 上下文管理  │ │ - docx生成   │ │ - 版本管理    │ │
│  │ - Provider   │ └──────┬──────┘ └───────────────┘ │
│  │   抽象层     │        │                            │
│  └───────┬──────┘ ┌──────▼──────┐                    │
│          │        │  Carbone /  │                    │
│  ┌───────▼──────┐ │ Docxtplater │                    │
│  │ AI Provider  │ └─────────────┘                    │
│  │ ┌──────────┐│                                     │
│  │ │通义法睿   ││  ← V1 当前接入                       │
│  │ ├──────────┤│                                     │
│  │ │DeepSeek  ││  ← 后续扩展                          │
│  │ ├──────────┤│                                     │
│  │ │其他模型   ││  ← 后续扩展                          │
│  │ └──────────┘│                                     │
│  └──────────────┘                                     │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │                 数据存储层                        │   │
│  │  PostgreSQL (业务数据) + 文件存储 (模板/输出文件)   │   │
│  └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

---

## 3. 技术选型

### 3.1 前端

| 组件 | 选型 | 理由 |
|------|------|------|
| 运行时/包管理 | **Bun** | 极快的安装速度与构建性能，内置bundler，替代npm/yarn/pnpm |
| 构建工具 | **Vite** | 开发体验佳，HMR极快，SolidJS官方推荐的构建工具 |
| 框架 | **SolidJS** | 真正的细粒度响应式，无Virtual DOM开销，编译时优化，bundle更小，性能优于React |
| 编辑器 | **Tiptap 2.x (Core)** + **solid-tiptap** | Tiptap核心基于ProseMirror，headless架构与框架无关；通过solid-tiptap提供SolidJS绑定 |
| UI组件库 | **Kobalte** + **Tailwind CSS** | Kobalte是SolidJS生态的headless UI库（类似Radix UI），配合Tailwind实现高度定制化样式 |
| 状态管理 | **SolidJS内置** (createSignal / createStore) | SolidJS自带细粒度响应式原语，无需额外状态管理库 |
| AI流式渲染 | **原生SSE处理** + **自封装Hook** | 通过EventSource或fetch+ReadableStream接收后端SSE流式输出 |

> **关于Tiptap + SolidJS的说明**：Tiptap Core (`@tiptap/core`) 是完全headless的，不依赖任何UI框架。社区的 `solid-tiptap` 包提供了 `createTiptapEditor` 等SolidJS原语。若社区包不满足需求，也可基于 `@tiptap/core` 自行封装薄层SolidJS绑定（约100行代码），核心是将editor实例桥接到SolidJS的响应式系统。

### 3.2 后端

| 组件 | 选型 | 理由 |
|------|------|------|
| 运行时 | **Bun** | 与前端统一技术栈，内置TypeScript支持，原生性能优异，兼容Node.js生态 |
| 语言 | **TypeScript** | 前后端统一语言，类型安全，与Bun天然配合 |
| API框架 | **Hono** | 轻量极速的Web框架，原生支持Bun/Deno/Node多运行时，中间件生态丰富，内置SSE支持 |
| docx模板引擎 | **Carbone** (主选) / **Docxtemplater** (备选) | 见下方 3.5 详细对比 |
| 数据库 | **PostgreSQL** | 存储模板元数据、文档记录、用户数据 |
| ORM | **Drizzle ORM** | 轻量、类型安全、Bun原生兼容好，SQL-like API直观，迁移工具简洁 |
| 文件存储 | **本地文件系统 → S3兼容存储** | 初期本地，后续迁移至对象存储 |

> **关于后端语言选择的说明**：选择TypeScript + Bun而非Go/Python等其他语言，核心原因是：(1) 前后端统一语言降低心智负担；(2) Bun运行时性能已可媲美Go的HTTP处理能力；(3) Tiptap JSON Schema的处理、Carbone模板引擎等核心依赖均为JS/TS生态；(4) 团队无需切换语言上下文，开发效率最高。

### 3.3 AI层

| 组件 | 选型 | 理由 |
|------|------|------|
| V1主模型 | **通义法睿 (farui-plus)** | 阿里云法律行业专用大模型，原生支持法律文书生成、争议焦点识别、法条预测等法律场景能力 |
| API平台 | **阿里云百炼 (DashScope)** | 通义法睿的官方API平台，提供OpenAI兼容接口，简化接入 |
| 后续扩展 | **DeepSeek / 通义千问 / GPT-4o** | 通过AI Provider抽象层接入多模型，支持横向对比和按需切换 |
| API调用方式 | **OpenAI JS SDK (兼容模式)** | DashScope提供OpenAI兼容端点，可直接使用`openai` npm包调用，未来切换其他OpenAI兼容模型零成本 |
| AI编排 | **自封装Provider模式** | 定义统一的AIProvider接口，每个模型实现该接口，V1仅实现通义法睿 |
| 知识库(后续) | **向量数据库(pgvector)** | 存储历史文书、法律法规片段用于RAG检索 |

> **关于通义法睿的关键参数**：
>
> | 参数 | 值 |
> |------|-----|
> | 模型名称 | `farui-plus` |
> | 输入输出总上限 | 14,000 tokens（输入+输出之和） |
> | 最大输入 | 12,000 tokens |
> | 最大输出 | 2,000 tokens（`max_tokens` 默认值） |
> | 输入成本 | 0.02元/千tokens |
> | 可选参数 | `top_p`(默认0.8)、`top_k`(默认无)、`temperature`、`max_tokens`、`seed` |
> | 流式输出 | 支持（SDK: `stream=True, incremental_output=True`；HTTP: `X-DashScope-SSE: enable` header） |
> | 多轮对话 | 支持，通过 messages 数组携带历史对话 |
> | 调用方式 | OpenAI兼容API（推荐）/ DashScope原生HTTP API / DashScope SDK (Python/Java) |
>
> **两种HTTP API端点对比**：
>
> | | OpenAI兼容端点（本项目采用） | DashScope原生端点 |
> |---|---|---|
> | URL | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation` |
> | Body格式 | `{ "model", "messages", "stream" }` (OpenAI标准) | `{ "model", "input": { "messages" }, "parameters": {...} }` |
> | SSE开启 | `"stream": true` | Header: `X-DashScope-SSE: enable` |
> | JS SDK | `openai` npm包直接使用 | 需自行封装HTTP请求 |
> | 优势 | 切换其他OpenAI兼容模型零成本 | DashScope特有参数支持更完整 |
>
> **输出长度限制应对策略**：2k tokens最大输出意味着单次生成约1500-2000字中文文本。法律意见书各章节通常在此范围内，但较长章节需在Prompt中明确控制输出长度，必要时将单个section拆分为sub-sections分次生成。同时需注意输入+输出总量不超过14k tokens，当传入较长的前序章节上下文时需做截断。

> **关于多AI对比架构的设计思路**：系统设计为Provider抽象层 + 统一接口模式。V1版本仅接入通义法睿一家，但架构上预留了多模型支持能力。后续扩展时，只需新增Provider实现类即可接入新模型，前端增加"模型选择"和"结果对比"面板。AI Provider接口定义见第5节。

### 3.4 部署

| 组件 | 选型 | 理由 |
|------|------|------|
| 前端部署 | **静态文件托管** (Nginx / Caddy / 云OSS) | SolidJS SPA编译为纯静态资源，部署简单 |
| 后端部署 | **自建VPS / 云服务器** | Bun服务直接运行，或Docker容器化部署 |
| 容器化 | **Docker** | 标准化部署，便于后续私有化交付 |

### 3.5 Docx模板引擎对比

| 维度 | Carbone | Docxtemplater |
|------|---------|---------------|
| 模板格式 | 直接用Word/LibreOffice制作，花括号标签 `{d.fieldName}` | 同样用Word制作，花括号标签 `{fieldName}` |
| 格式保真 | 高，不修改模板的XML结构，仅替换标签内容 | 高，同样在原始XML上操作 |
| 动态内容 | 支持循环、条件、嵌套对象、HTML注入 | 支持循环、条件、需付费模块支持HTML注入和图片 |
| 输出格式 | docx/odt/xlsx → 可通过LibreOffice转PDF | 仅docx/pptx/xlsx，PDF需外部工具 |
| 开源协议 | 社区版MIT，企业版付费 | 核心MIT，高级模块付费 |
| 长段落AI文本 | 支持 `:html` 格式化器注入富文本HTML | 需购买HTML模块 |
| Bun兼容性 | 通过Node.js兼容层运行，需验证 | 纯JS实现，兼容性好 |
| 推荐场景 | 需要注入AI生成的富文本段落（含加粗、列表等） | 结构化字段替换为主的简单场景 |

**结论**：选 **Carbone**。核心原因是AI生成的法律意见分析内容不是纯文本，可能包含加粗、编号列表、分段等格式，Carbone的HTML格式化器可以直接将编辑器输出的HTML注入到Word模板中并保留格式。需在开发初期验证Carbone在Bun运行时下的兼容性，如有问题则回退至Docxtemplater + 付费HTML模块。

---

## 4. 核心数据模型

### 4.1 文书结构 Schema

这是整个系统的核心数据结构——连接编辑器、AI生成、模板导出三个环节。

```typescript
// 文书模板定义
interface DocumentTemplate {
  id: string;
  name: string;                    // "法律意见分析书"
  description: string;
  templateFileUrl: string;         // Word模板文件路径
  sections: SectionDefinition[];   // 区块定义
  createdAt: Date;
  updatedAt: Date;
}

// 区块定义——模板中的每个可编辑章节
interface SectionDefinition {
  id: string;
  key: string;                     // 对应模板标签，如 "fact_summary"
  title: string;                   // "事实概述"
  order: number;
  promptTemplate: string;          // 该区块的AI生成Prompt模板
  isRequired: boolean;
  allowAIRegenerate: boolean;      // 是否允许AI重新生成
  contentType: 'richtext' | 'plaintext' | 'table' | 'list';
}

// 文书实例——一次具体的文书编辑会话
interface DocumentInstance {
  id: string;
  templateId: string;
  title: string;
  factInput: string;               // 律师输入的原始事实
  sections: SectionInstance[];     // 各区块的实际内容
  status: 'draft' | 'reviewing' | 'finalized';
  aiProvider: string;              // 使用的AI模型标识，如 "farui-plus"
  createdAt: Date;
  updatedAt: Date;
}

// 区块实例——每个章节的实际内容
interface SectionInstance {
  id: string;
  definitionId: string;
  key: string;
  content: TiptapJSON;             // Tiptap编辑器的JSON格式内容
  contentHtml: string;             // 渲染后的HTML，用于模板填充
  version: number;                 // 版本号，每次AI重新生成递增
  lastEditedBy: 'ai' | 'human';
  generationPrompt?: string;       // 生成该版本时使用的prompt
  aiProvider?: string;             // 生成该版本使用的AI模型
}
```

### 4.2 数据库表结构 (Drizzle Schema)

```typescript
import { pgTable, uuid, varchar, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';

// 文书模板
export const documentTemplates = pgTable('document_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  templateFilePath: varchar('template_file_path', { length: 500 }).notNull(),
  sections: jsonb('sections').notNull(),              // SectionDefinition[]
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 文书实例
export const documentInstances = pgTable('document_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').references(() => documentTemplates.id),
  title: varchar('title', { length: 255 }).notNull(),
  factInput: text('fact_input').notNull(),
  status: varchar('status', { length: 20 }).default('draft'),
  aiProvider: varchar('ai_provider', { length: 50 }).default('farui-plus'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 区块内容（独立表，便于版本追踪）
export const sectionContents = pgTable('section_contents', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documentInstances.id),
  sectionKey: varchar('section_key', { length: 100 }).notNull(),
  contentJson: jsonb('content_json').notNull(),        // Tiptap JSON
  contentHtml: text('content_html').notNull(),
  version: integer('version').default(1),
  lastEditedBy: varchar('last_edited_by', { length: 10 }).default('ai'),
  generationPrompt: text('generation_prompt'),
  aiProvider: varchar('ai_provider', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// 后续扩展：AI Provider 配置
// export const aiProviders = pgTable('ai_providers', { ... });

// 后续扩展：知识库文档（用于RAG）
// export const knowledgeDocuments = pgTable('knowledge_documents', { ... });
```

---

## 5. 核心模块设计

### 5.1 AI Provider 抽象层

为支持后续多模型对比，设计统一的AI Provider接口：

```typescript
// AI Provider 统一接口
interface AIProvider {
  id: string;                      // "farui-plus", "deepseek-chat", etc.
  name: string;                    // 显示名称

  // 流式生成
  streamGenerate(params: GenerateParams): AsyncGenerator<StreamChunk>;

  // 非流式生成（用于短文本场景）
  generate(params: GenerateParams): Promise<GenerateResult>;
}

interface GenerateParams {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

interface StreamChunk {
  content: string;
  finishReason?: 'stop' | 'length' | null;
}

interface GenerateResult {
  content: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
}
```

#### 5.1.1 通义法睿 Provider 实现（V1）

```typescript
import OpenAI from 'openai';

class FaruiProvider implements AIProvider {
  id = 'farui-plus';
  name = '通义法睿';

  private client: OpenAI;

  constructor() {
    // 使用DashScope的OpenAI兼容端点
    this.client = new OpenAI({
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });
  }

  async *streamGenerate(params: GenerateParams): AsyncGenerator<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: 'farui-plus',
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      max_tokens: params.maxTokens ?? 2000,
      temperature: params.temperature ?? 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield {
          content: delta,
          finishReason: chunk.choices[0]?.finish_reason as any,
        };
      }
    }
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const response = await this.client.chat.completions.create({
      model: 'farui-plus',
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      max_tokens: params.maxTokens ?? 2000,
      temperature: params.temperature ?? 0.7,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }
}

// Provider 注册表
class AIProviderRegistry {
  private providers = new Map<string, AIProvider>();

  register(provider: AIProvider) {
    this.providers.set(provider.id, provider);
  }

  get(id: string): AIProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`AI Provider "${id}" not found`);
    return provider;
  }

  listAll(): AIProvider[] {
    return Array.from(this.providers.values());
  }
}

// 初始化（V1仅注册通义法睿）
const registry = new AIProviderRegistry();
registry.register(new FaruiProvider());
// 后续: registry.register(new DeepSeekProvider());
// 后续: registry.register(new QwenProvider());
```

### 5.2 模板管理模块

```
功能清单：
├── 上传Word模板文件（.docx）
├── 定义模板中的可编辑区块（section）
│   ├── 区块名称、排序
│   ├── 对应的模板标签名（如 {d.fact_summary}）
│   └── 该区块的AI生成Prompt模板
├── 模板预览
├── 模板版本管理
└── 模板列表与搜索
```

**模板文件制作规范**：律师使用Word制作模板文件，在需要动态填充内容的位置写入Carbone标签，例如：

```
一、事实概述
{d.fact_summary:html}

二、法律依据分析
{d.legal_analysis:html}

三、风险评估
{d.risk_assessment:html}

四、结论与建议
{d.conclusion:html}
```

`:html` 后缀告知Carbone将内容作为富文本HTML注入，保留加粗、列表等格式。

### 5.3 AI生成模块

#### 5.3.1 全文生成流程

```typescript
async function* generateFullDocument(
  factInput: string,
  template: DocumentTemplate,
  providerId: string = 'farui-plus'
): AsyncGenerator<StreamChunk & { sectionKey: string; status: string }> {

  const provider = registry.get(providerId);
  const generatedSections: Array<{ title: string; contentHtml: string }> = [];

  for (const section of template.sections) {
    // 为每个区块构建prompt
    const userPrompt = buildSectionPrompt({
      sectionDef: section,
      factInput,
      previousSections: generatedSections,
      templateContext: template.description
    });

    // 流式调用AI Provider
    let sectionContent = '';
    for await (const chunk of provider.streamGenerate({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2000,    // farui-plus 最大输出限制
    })) {
      sectionContent += chunk.content;
      yield {
        sectionKey: section.key,
        content: chunk.content,
        status: 'streaming'
      };
    }

    generatedSections.push({ title: section.title, contentHtml: sectionContent });
    yield { sectionKey: section.key, content: '', status: 'complete' };
  }
}
```

#### 5.3.2 段落级重写流程

```typescript
async function* regenerateSection(
  documentId: string,
  sectionKey: string,
  userInstruction: string,
  selectedText?: string,
  providerId: string = 'farui-plus'
): AsyncGenerator<StreamChunk & { sectionKey: string; status: string }> {

  const provider = registry.get(providerId);
  const document = await getDocument(documentId);
  const currentContent = await getSectionContent(documentId, sectionKey);

  const userPrompt = selectedText
    ? buildPartialRewritePrompt({
        fullSectionContent: currentContent.contentHtml,
        selectedText,
        userInstruction,
        factInput: document.factInput
      })
    : buildFullSectionRewritePrompt({
        currentContent: currentContent.contentHtml,
        userInstruction,
        factInput: document.factInput
      });

  for await (const chunk of provider.streamGenerate({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 2000,
  })) {
    yield { sectionKey, content: chunk.content, status: 'streaming' };
  }

  yield { sectionKey, content: '', status: 'complete' };
}
```

#### 5.3.3 Prompt设计要点

```typescript
const SYSTEM_PROMPT = `你是一位资深中国律师助手，专门协助撰写法律文书。

你的输出规则：
1. 使用规范的法律术语和专业表达
2. 引用法律条文时使用完整格式：《法律名称》第X条
3. 输出格式为HTML片段（允许使用 <p> <strong> <ul> <ol> <li> 标签）
4. 不要输出完整HTML文档结构，只输出内容片段
5. 保持客观中立的分析立场
6. 事实描述与法律分析严格分开
7. 控制输出长度，确保核心内容完整表达（注意单次输出不超过1800字）
`;

function buildSectionPrompt({ sectionDef, factInput, previousSections }) {
  return `
## 任务
根据以下案件事实，撰写法律意见分析书中的【${sectionDef.title}】部分。

## 案件事实
${factInput}

${previousSections.length > 0 ? `
## 已完成的前序章节（供上下文参考，确保行文连贯）
${previousSections.map(s => `### ${s.title}\n${s.contentHtml}`).join('\n\n')}
` : ''}

## 该章节的写作要求
${sectionDef.promptTemplate}

## 输出要求
直接输出该章节的正文内容（HTML片段格式），不要包含章节标题，不要包含其他章节。
`;
}
```

### 5.4 编辑器模块

#### 5.4.1 Tiptap编辑器配置（SolidJS）

```typescript
import { createTiptapEditor } from 'solid-tiptap';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

// 自定义区块节点
import { SectionBlock } from './extensions/SectionBlock';
// AI交互扩展
import { AIRewrite } from './extensions/AIRewrite';

function DocumentEditor(props: { template: DocumentTemplate; documentId: string }) {
  const editor = createTiptapEditor(() => ({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: '输入案件事实...',
      }),

      // 自定义：文书区块节点
      SectionBlock.configure({
        sections: props.template.sections,
      }),

      // 自定义：AI重写扩展
      AIRewrite.configure({
        onRewrite: async ({ selectedText, sectionKey, instruction }) => {
          const response = await fetch('/api/ai/rewrite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId: props.documentId,
              sectionKey,
              selectedText,
              instruction,
            }),
          });
          return response;   // SSE stream
        },
      }),
    ],
  }));

  return (
    <div class="editor-container">
      {/* editor 渲染区域 */}
      <div ref={(el) => editor()?.mount(el)} />
    </div>
  );
}
```

#### 5.4.2 SSE流式接收（SolidJS Hook）

```typescript
import { createSignal } from 'solid-js';

function createSSEStream(url: string, body: object) {
  const [content, setContent] = createSignal('');
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);

  async function start() {
    setIsStreaming(true);
    setContent('');
    setError(null);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        // 解析SSE格式
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              setContent(prev => prev + data.content);
            }
          }
        }
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsStreaming(false);
    }
  }

  return { content, isStreaming, error, start };
}
```

#### 5.4.3 编辑器交互设计

```
┌─────────────────────────────────────────────────┐
│  法律意见分析书 - 张三诉李四合同纠纷案            │
│─────────────────────────────────────────────────│
│                                                   │
│  ┌─ 一、事实概述 ─────────────── [重新生成] ────┐ │
│  │                                               │ │
│  │  2024年3月15日，张三与李四签订《商品房          │ │
│  │  买卖合同》，约定李四将位于XX市XX区的          │ │
│  │  房产以人民币 ███████████████████             │ │
│  │                ↑                              │ │
│  │         用户选中文本                           │ │
│  │      ┌──────────────────┐                     │ │
│  │      │ AI重写            │                     │ │
│  │      │ 修改提示词         │                     │ │
│  │      │ 复制              │                     │ │
│  │      └──────────────────┘                     │ │
│  │                                               │ │
│  └───────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ 二、法律依据分析 ────────── [重新生成] ────┐ │
│  │                                               │ │
│  │  根据《中华人民共和国民法典》第五百零九条...    │ │
│  │                                               │ │
│  └───────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ 三、风险评估 ────────────── [重新生成] ────┐ │
│  │  ...                                          │ │
│  └───────────────────────────────────────────────┘ │
│                                                   │
│                              [ 保存 ] [ 导出docx ] │
└─────────────────────────────────────────────────┘
```

#### 5.4.4 AI交互流程（选中重写）

```
1. 用户在编辑器中选中一段文字
2. 弹出浮动工具栏，显示"AI重写"按钮
3. 点击后弹出输入框，用户输入修改指令
   例如："语气更强硬"、"补充关于违约金的法律依据"、"缩短这段"
4. 前端调用后端 POST /api/ai/rewrite，传入：
   - 当前区块完整内容
   - 选中的文本
   - 用户的修改指令
   - 原始事实输入（上下文）
5. 后端通过SSE流式返回修改后的内容
6. 前端以打字机效果替换选中区域（或整段）
7. 替换完成后，内容自动保存，版本号+1
```

### 5.5 文档导出模块

#### 5.5.1 导出流程

```typescript
import Carbone from 'carbone';

async function exportDocx(documentId: string): Promise<Buffer> {
  // 1. 获取文书实例及所有区块内容
  const doc = await getDocumentWithSections(documentId);

  // 2. 构建Carbone数据对象
  const data = {
    title: doc.title,
    date: formatDate(new Date()),
    lawyer_name: doc.lawyerName,
    case_number: doc.caseNumber,

    // 各区块的HTML内容
    fact_summary: doc.sections.find(s => s.key === 'fact_summary')?.contentHtml || '',
    legal_analysis: doc.sections.find(s => s.key === 'legal_analysis')?.contentHtml || '',
    risk_assessment: doc.sections.find(s => s.key === 'risk_assessment')?.contentHtml || '',
    conclusion: doc.sections.find(s => s.key === 'conclusion')?.contentHtml || '',
  };

  // 3. 读取Word模板文件
  const templatePath = await getTemplatePath(doc.templateId);

  // 4. Carbone渲染
  return new Promise((resolve, reject) => {
    Carbone.render(templatePath, data, {
      convertTo: 'docx'
    }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}
```

#### 5.5.2 HTML到docx的格式映射

编辑器输出的HTML通过Carbone的 `:html` 格式化器注入模板，支持的格式映射：

```
HTML标签          →    Word格式
─────────────────────────────
<p>              →    普通段落
<strong>/<b>     →    加粗
<em>/<i>         →    斜体
<u>              →    下划线
<ol><li>         →    有序列表
<ul><li>         →    无序列表
<br>             →    换行
<h1>~<h6>        →    标题样式（但在区块内一般不用）
```

---

## 6. 后端API设计（Hono路由）

### 6.1 Hono应用入口

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { stream } from 'hono/streaming';

const app = new Hono();

// 中间件
app.use('*', cors({
  origin: ['http://localhost:5173'],  // Vite dev server
}));

// 路由挂载
app.route('/api/ai', aiRoutes);
app.route('/api/documents', documentRoutes);
app.route('/api/templates', templateRoutes);

export default {
  port: 3000,
  fetch: app.fetch,
};
```

### 6.2 AI生成路由（SSE流式）

```typescript
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

const aiRoutes = new Hono();

// 全文生成
aiRoutes.post('/generate', async (c) => {
  const { templateId, factInput, providerId } = await c.req.json();
  const template = await getTemplate(templateId);

  return streamSSE(c, async (stream) => {
    for await (const chunk of generateFullDocument(factInput, template, providerId)) {
      await stream.writeSSE({
        data: JSON.stringify(chunk),
        event: 'chunk',
      });
    }
  });
});

// 段落重写
aiRoutes.post('/rewrite', async (c) => {
  const { documentId, sectionKey, instruction, selectedText, providerId } = await c.req.json();

  return streamSSE(c, async (stream) => {
    for await (const chunk of regenerateSection(
      documentId, sectionKey, instruction, selectedText, providerId
    )) {
      await stream.writeSSE({
        data: JSON.stringify(chunk),
        event: 'chunk',
      });
    }
  });
});
```

### 6.3 文书管理路由

```
GET    /api/documents                 # 文书列表
POST   /api/documents                 # 新建文书
GET    /api/documents/:id             # 文书详情（含所有区块内容）
PUT    /api/documents/:id             # 更新文书元数据
DELETE /api/documents/:id             # 删除文书

PUT    /api/documents/:id/sections    # 批量保存区块内容
PUT    /api/documents/:id/sections/:key  # 保存单个区块内容

POST   /api/documents/:id/export      # 导出docx
  Response: application/octet-stream (docx文件)
```

### 6.4 模板管理路由

```
GET    /api/templates                 # 模板列表
POST   /api/templates                 # 新建模板（含上传docx文件）
GET    /api/templates/:id             # 模板详情
PUT    /api/templates/:id             # 更新模板
DELETE /api/templates/:id             # 删除模板
```

---

## 7. 项目结构

```
legal-ai-doc/
├── packages/
│   ├── frontend/                     # SolidJS 前端
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── index.tsx
│   │       │
│   │       ├── pages/
│   │       │   ├── Home.tsx                # 首页/文书列表
│   │       │   ├── DocumentNew.tsx         # 新建文书（选模板+输入事实）
│   │       │   ├── DocumentEdit.tsx        # 文书编辑页（核心页面）
│   │       │   ├── TemplateList.tsx        # 模板管理列表
│   │       │   └── TemplateEdit.tsx        # 模板编辑（区块定义）
│   │       │
│   │       ├── components/
│   │       │   ├── editor/
│   │       │   │   ├── DocumentEditor.tsx  # 主编辑器容器
│   │       │   │   ├── SectionBlock.tsx    # 区块组件
│   │       │   │   ├── AIToolbar.tsx       # AI浮动工具栏
│   │       │   │   ├── AIRewriteDialog.tsx # 重写指令输入弹窗
│   │       │   │   └── StreamingContent.tsx# 流式内容展示
│   │       │   ├── templates/
│   │       │   │   ├── TemplateList.tsx
│   │       │   │   └── SectionDefEditor.tsx
│   │       │   └── ui/                     # Kobalte + Tailwind 通用组件
│   │       │
│   │       ├── lib/
│   │       │   ├── api.ts                  # 后端API调用封装
│   │       │   ├── sse.ts                  # SSE流式处理Hook
│   │       │   └── editor/
│   │       │       ├── extensions/         # Tiptap自定义扩展
│   │       │       │   ├── SectionBlock.ts
│   │       │       │   └── AIRewrite.ts
│   │       │       └── schema.ts
│   │       │
│   │       ├── stores/
│   │       │   ├── document.ts             # 文书编辑状态（createStore）
│   │       │   └── ai.ts                   # AI生成状态
│   │       │
│   │       └── types/
│   │           ├── document.ts
│   │           ├── template.ts
│   │           └── ai.ts
│   │
│   └── backend/                      # Bun + Hono 后端
│       ├── package.json
│       ├── tsconfig.json
│       ├── drizzle.config.ts
│       ├── src/
│       │   ├── index.ts              # Hono应用入口
│       │   │
│       │   ├── routes/
│       │   │   ├── ai.ts             # AI生成/重写路由
│       │   │   ├── documents.ts      # 文书CRUD路由
│       │   │   └── templates.ts      # 模板CRUD路由
│       │   │
│       │   ├── services/
│       │   │   ├── ai/
│       │   │   │   ├── provider.ts   # AIProvider接口定义
│       │   │   │   ├── registry.ts   # Provider注册表
│       │   │   │   ├── farui.ts      # 通义法睿实现
│       │   │   │   └── prompts.ts    # Prompt模板
│       │   │   ├── document.ts       # 文书业务逻辑
│       │   │   ├── template.ts       # 模板业务逻辑
│       │   │   └── export.ts         # Carbone导出封装
│       │   │
│       │   ├── db/
│       │   │   ├── schema.ts         # Drizzle表定义
│       │   │   ├── index.ts          # 数据库连接
│       │   │   └── migrations/       # 数据库迁移文件
│       │   │
│       │   └── lib/
│       │       ├── html-sanitizer.ts # HTML清洗
│       │       └── utils.ts
│       │
│       └── templates/                # Word模板文件存储目录
│           └── legal-opinion-v1.docx
│
├── package.json                      # 根package.json (workspace)
├── bun.lockb
├── docker-compose.yml                # 本地开发环境（PostgreSQL）
├── Dockerfile.frontend
├── Dockerfile.backend
└── README.md
```

---

## 8. 开发阶段规划

### Phase 1：核心MVP

- [ ] Bun Workspace Monorepo项目脚手架搭建
  - `mkdir LexDocEngine && cd LexDocEngine && bun init -y`  # 根项目初始化
  - 配置 `package.json` 中的 `workspaces: ["packages/*"]`
  - `cd packages && bun create solid frontend`  # 前端SolidJS + Vite项目初始化
  - `mkdir backend && cd backend && bun init -y`  # 后端项目初始化
  - 安装后端依赖：`bun add hono drizzle-orm postgres`
  - 安装AI依赖：`bun add openai`（通过DashScope OpenAI兼容端点调用通义法睿）
- [ ] 后端：通义法睿 AI Provider实现与验证（API连通、流式输出）
- [ ] 后端：Hono SSE流式输出路由
- [ ] 前端：基础Tiptap编辑器（SolidJS集成，无区块化，纯富文本编辑）
- [ ] 前端：SSE流式接收与打字机效果展示
- [ ] 单一Prompt全文生成（非区块化，一次性生成整篇文书）
- [ ] 基础docx导出（硬编码模板，Carbone最小化集成 + Bun兼容性验证）
- [ ] 验证核心流程：输入事实 → AI生成 → 编辑 → 导出docx

### Phase 2：区块化编辑

- [ ] 自定义Tiptap SectionBlock扩展
- [ ] 分区块逐段生成（每个区块独立Prompt，流式逐段展示）
- [ ] 区块级"重新生成"功能
- [ ] 选中文本AI重写功能
- [ ] 重写指令输入浮动面板
- [ ] 区块内容版本管理（保存历史版本，支持回退）

### Phase 3：模板系统

- [ ] 模板管理后台（上传docx模板、定义区块、配置Prompt）
- [ ] 多模板支持（法律意见书、律师函、合同审查意见等）
- [ ] 模板预览功能
- [ ] 动态表单字段（日期、案号、委托人信息等元数据字段）

### Phase 4：体验优化

- [ ] 编辑器UI打磨（工具栏、快捷键、拖拽排序）
- [ ] AI生成质量优化（Prompt迭代、few-shot示例）
- [ ] 文书列表页（历史文书管理、搜索、筛选）
- [ ] 自动保存
- [ ] 错误处理与边界情况覆盖

### Phase 5：多模型对比与进阶功能

- [ ] 多AI Provider接入（DeepSeek、通义千问等）
- [ ] 前端模型选择器与结果横向对比面板
- [ ] 同一段落多模型并行生成，律师挑选最佳结果
- [ ] RAG知识库（导入法律法规、历史文书，生成时检索引用）
- [ ] 协作功能（多人编辑同一文书）
- [ ] 用户权限体系
- [ ] 私有化部署方案

---

## 9. 依赖清单

### 前端 (packages/frontend/package.json)

```json
{
  "dependencies": {
    "solid-js": "^1.9.0",

    "@tiptap/core": "^2.10.0",
    "@tiptap/starter-kit": "^2.10.0",
    "@tiptap/extension-placeholder": "^2.10.0",
    "solid-tiptap": "latest",

    "@kobalte/core": "latest",

    "tailwindcss": "^4.0.0",
    "clsx": "latest",

    "@solidjs/router": "latest"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "vite-plugin-solid": "latest",
    "typescript": "^5.7.0"
  }
}
```

### 后端 (packages/backend/package.json)

```json
{
  "dependencies": {
    "hono": "^4.0.0",

    "openai": "^4.0.0",

    "carbone": "^3.5.0",

    "drizzle-orm": "latest",
    "postgres": "latest",

    "zod": "^3.23.0"
  },
  "devDependencies": {
    "drizzle-kit": "latest",
    "@types/bun": "latest",
    "typescript": "^5.7.0"
  }
}
```

---

## 10. 注意事项与风险

### 10.1 AI输出质量

- 法律文书对准确性要求极高，AI可能产生"幻觉"（编造法条、案例）
- 通义法睿作为法律专用模型，在法律术语和文书格式方面优于通用模型，但仍需严格审核
- **缓解措施**：Prompt中明确要求"只引用确实存在的法律条文"，后续通过RAG注入真实法律数据库，提供"引用来源标注"功能
- 产品定位应始终强调"AI辅助生成，律师审核修改"，而非全自动

### 10.2 通义法睿输出长度限制

- farui-plus 最大输出仅 2,000 tokens（约1500-2000字中文）
- 法律意见书单个章节通常可控制在此范围内，但复杂案件的"法律依据分析"章节可能超出
- **缓解措施**：在Prompt中明确控制输出长度；对于复杂章节，支持拆分为子区块分次生成；后续接入输出上限更高的模型（如DeepSeek 8k输出）时可对比效果

### 10.3 DashScope API 稳定性

- 作为唯一AI后端，DashScope服务宕机将导致核心功能不可用
- **缓解措施**：V1先接受此风险；Phase 5接入多Provider后，可实现自动降级（通义法睿不可用时切换到备选模型）

### 10.4 Carbone HTML注入的限制

- Carbone的 `:html` 格式化器支持基础HTML标签，但复杂格式（嵌套表格、图片等）可能有兼容问题
- **缓解措施**：在编辑器和导出之间增加HTML清洗层，将编辑器输出的HTML标准化为Carbone支持的子集

### 10.5 Tiptap SolidJS 生态成熟度

- Tiptap官方仅提供React和Vue绑定，SolidJS绑定依赖社区维护的 `solid-tiptap`
- **缓解措施**：`solid-tiptap` 仅是Tiptap Core的薄层封装（~200行），即使社区包不维护也可自行fork；核心逻辑在framework-agnostic的 `@tiptap/core` 中

### 10.6 Bun 运行时兼容性

- Bun虽然高度兼容Node.js，但个别npm包（如Carbone依赖的native addon）可能存在兼容问题
- **缓解措施**：Phase 1优先验证Carbone在Bun下的运行情况；如不兼容，可在导出服务单独使用Node.js运行，或切换到纯JS实现的Docxtemplater

### 10.7 数据安全

- 法律文书包含高度敏感信息，AI API调用会将内容传输至阿里云
- **缓解措施**：通义法睿部署在国内阿里云，数据不出境，符合国内数据合规要求；后续考虑私有化部署开源模型
