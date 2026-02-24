# 阶段一：构建
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

# 构建时注入 API 地址（生产环境通过 Nginx 反代，使用相对路径）
ENV VITE_API_BASE_URL=""
RUN bun run build

# 阶段二：Nginx 托管静态文件
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
