# LexDocEngine 部署文档

## 架构概览

```
用户浏览器
    │
    ▼ HTTPS :<APP_PORT>
[ Nginx 反向代理 ]
    ├── /        → frontend (SolidJS 静态文件, Nginx:80)
    ├── /api/*   → backend (Bun + Hono, :3000)
    └── /health  → backend
         │
         ▼
[ PostgreSQL 17 + pgvector ]
```

所有服务通过 Docker Compose 编排，数据通过 named volume 持久化。

---

## 文件结构

```
LexDocEngine/
├── docker-compose.yml          # 服务编排（4 个服务）
├── .env.production             # 生产环境变量（不提交 git）
├── deploy.sh                   # 运维脚本
├── nginx/
│   └── nginx.conf              # 入口 Nginx 反向代理配置（TLS）
├── packages/
│   ├── backend/
│   │   ├── Dockerfile
│   │   └── src/db/migrations/  # Drizzle 迁移文件
│   └── frontend/
│       ├── Dockerfile          # 多阶段构建：Bun build → Nginx
│       └── nginx.conf          # 前端容器内 Nginx（SPA 路由）
```

---

## 环境变量（.env.production）

复制 `.env.production.example` 并填入真实值：

```env
# 数据库
DB_USER=lexdoc
DB_PASSWORD=<强密码>
DB_NAME=lexdoc_db

# 通义 DashScope API Key
# 获取地址：https://dashscope.console.aliyun.com/
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx

# 对外暴露的 HTTPS 端口
APP_PORT=9443
```

---

## TLS 证书

Nginx 容器通过 volume 挂载宿主机上的证书文件（只读），在 `docker-compose.yml` 中配置：

```yaml
volumes:
  - /etc/ssl/<your-domain>/fullchain.pem:/etc/nginx/ssl/fullchain.pem:ro
  - /etc/ssl/<your-domain>/privkey.pem:/etc/nginx/ssl/privkey.pem:ro
```

`nginx/nginx.conf` 中对应：

```nginx
ssl_certificate     /etc/nginx/ssl/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/privkey.pem;
```

证书到期后在宿主机续签，然后执行：
```bash
docker compose restart nginx
```

---

## 服务器要求

- Ubuntu 20.04+
- Docker 27+（含 Docker Compose v2）
- 用户在 docker 组：`sudo usermod -aG docker $USER`

### 国内服务器配置 Docker 镜像加速

```bash
sudo tee /etc/docker/daemon.json > /dev/null << 'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
EOF
sudo systemctl restart docker
```

---

## 首次部署

```bash
# 1. 克隆项目
git clone <仓库地址> /opt/LexDocEngine
cd /opt/LexDocEngine

# 2. 配置环境变量
cp .env.production.example .env.production
vi .env.production  # 填入 DB 密码和 API Key

# 3. 构建并启动
docker compose --env-file .env.production up -d --build

# 4. 验证
curl https://<your-domain>:<APP_PORT>/health
```

---

## 日常更新

本地修改代码后，将文件同步到服务器并重新构建：

```bash
# 同步文件（排除不必要的目录）
rsync -avz \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='packages/backend/.env' \
  -e 'ssh -p <PORT>' \
  ./ <user>@<server>:<remote-path>/

# 重新构建并重启
ssh -p <PORT> <user>@<server> \
  "cd <remote-path> && docker compose --env-file .env.production up -d --build"
```

---

## 常用运维命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
docker compose logs -f backend

# 重启某个服务（不重新构建）
docker compose restart backend

# 停止所有服务（保留数据）
docker compose down

# 停止并删除数据 ⚠️ 不可恢复
docker compose down -v
```

---

## 数据库

### 连接

```bash
docker exec -it lexdoc-postgres psql -U lexdoc -d lexdoc_db
```

### 数据持久化

| Volume | 内容 |
|--------|------|
| `lexdocengine_postgres_data` | PostgreSQL 数据文件 |
| `lexdocengine_uploads_data` | 用户上传的文件 |

`docker compose down`（不加 `-v`）不会删除数据；只有 `down -v` 或手动 `docker volume rm` 才会删除。

### 迁移

后端容器启动时自动执行 `bunx drizzle-kit migrate`，依据 `meta/_journal.json` 按序应用迁移。

| 文件 | 说明 |
|------|------|
| `0000_left_mongu.sql` | 初始表结构 |
| `0001_damp_photon.sql` | 补充字段 |
| `0002_add_rag_support.sql` | pgvector 扩展、RAG 相关表 |
| `0003_document_library.sql` | 重构为全局文档库（library_documents + document_library_links） |

> **注意：** 如果迁移未完整执行（如 journal 不完整），参考 `DEPLOY.md` 中的手动补跑 SQL，或查阅项目 Wiki。

### 手动补跑所有迁移（应急）

```bash
docker exec -i lexdoc-postgres psql -U lexdoc -d lexdoc_db << 'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "document_instances" ADD COLUMN IF NOT EXISTS "additional_notes" text;

CREATE TABLE IF NOT EXISTS "reference_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid,
  "original_file_name" varchar(500) NOT NULL,
  "file_type" varchar(10) NOT NULL,
  "file_path" varchar(1000) NOT NULL,
  "file_size" integer,
  "extracted_text" text,
  "processing_status" varchar(20) DEFAULT 'pending',
  "error_message" text,
  "chunk_count" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "document_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reference_doc_id" uuid,
  "document_id" uuid,
  "chunk_index" integer NOT NULL,
  "content" text NOT NULL,
  "token_count" integer,
  "embedding" vector(1024),
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_hash VARCHAR(64) NOT NULL UNIQUE,
  original_file_name VARCHAR(500) NOT NULL,
  file_type VARCHAR(10) NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  file_size INTEGER,
  extracted_text TEXT,
  processing_status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  chunk_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_library_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES document_instances(id) ON DELETE CASCADE,
  library_doc_id UUID NOT NULL REFERENCES library_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(document_id, library_doc_id)
);

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS library_doc_id UUID REFERENCES library_documents(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chunks_library_doc_id ON document_chunks(library_doc_id);
CREATE INDEX IF NOT EXISTS "idx_chunks_embedding" ON "document_chunks"
  USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);
SQL
```

---

## 已知问题

- **端口冲突**：若宿主机已有服务占用目标端口，修改 `.env.production` 中的 `APP_PORT`。
- **docker 组权限**：新加入 docker 组需重新登录，或用 `sg docker -c '...'` 临时生效。
- **证书续签**：Let's Encrypt 证书有效期 90 天，到期前在宿主机续签后重启 nginx 容器。
