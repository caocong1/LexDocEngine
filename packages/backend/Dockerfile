FROM oven/bun:1 AS base
WORKDIR /app

# 安装系统依赖（mupdf 需要）
RUN apt-get update && apt-get install -y \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

# 先复制依赖文件，利用 Docker 缓存
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# 复制源码
COPY . .

EXPOSE 3000

# 启动命令：先执行迁移，再启动服务
CMD ["sh", "-c", "bunx drizzle-kit migrate && bun src/index.ts"]
