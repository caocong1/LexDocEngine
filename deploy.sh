#!/bin/bash
set -e

# ============================================
# LexDocEngine 一键部署脚本
# 用法：
#   首次部署：  ./deploy.sh setup
#   更新部署：  ./deploy.sh update
#   查看日志：  ./deploy.sh logs
#   停止服务：  ./deploy.sh stop
# ============================================

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$PROJECT_DIR/.env.production"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[部署]${NC} $1"; }
warn() { echo -e "${YELLOW}[警告]${NC} $1"; }
err() { echo -e "${RED}[错误]${NC} $1"; exit 1; }

# 检查 .env.production 是否存在
check_env() {
    if [ ! -f "$ENV_FILE" ]; then
        err "未找到 $ENV_FILE，请先复制并修改：cp .env.production.example .env.production"
    fi
}

# 首次安装服务器依赖
setup() {
    log "开始首次部署..."
    check_env

    # 检查 Docker 是否安装
    if ! command -v docker &> /dev/null; then
        log "安装 Docker..."
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker
        systemctl start docker
    fi

    # 检查 docker compose 是否可用
    if ! docker compose version &> /dev/null; then
        err "Docker Compose 不可用，请检查 Docker 安装"
    fi

    # 检查 git
    if ! command -v git &> /dev/null; then
        log "安装 Git..."
        apt-get update && apt-get install -y git
    fi

    log "构建并启动所有服务..."
    cd "$PROJECT_DIR"
    docker compose --env-file "$ENV_FILE" up -d --build

    log "等待服务启动..."
    sleep 5

    # 健康检查
    if curl -sf http://localhost:${APP_PORT:-80}/health > /dev/null 2>&1; then
        log "部署成功！服务已在 http://$(hostname -I | awk '{print $1}'):${APP_PORT:-80} 运行"
    else
        warn "服务可能还在启动中，请稍后检查：docker compose logs -f"
    fi
}

# 快速更新（拉取代码 + 重新构建 + 重启）
update() {
    log "拉取最新代码..."
    cd "$PROJECT_DIR"
    git pull

    log "重新构建并部署..."
    docker compose --env-file "$ENV_FILE" up -d --build

    log "更新完成！"
    docker compose ps
}

# 查看日志
logs() {
    cd "$PROJECT_DIR"
    docker compose logs -f --tail=100 "${@:2}"
}

# 停止服务
stop() {
    cd "$PROJECT_DIR"
    docker compose --env-file "$ENV_FILE" down
    log "服务已停止"
}

# 重启服务（不重新构建）
restart() {
    cd "$PROJECT_DIR"
    docker compose --env-file "$ENV_FILE" restart
    log "服务已重启"
}

# 查看状态
status() {
    cd "$PROJECT_DIR"
    docker compose ps
}

# 入口
case "${1:-help}" in
    setup)   setup ;;
    update)  update ;;
    logs)    logs "$@" ;;
    stop)    stop ;;
    restart) restart ;;
    status)  status ;;
    *)
        echo "用法: $0 {setup|update|logs|stop|restart|status}"
        echo ""
        echo "  setup    - 首次部署（安装依赖 + 构建 + 启动）"
        echo "  update   - 更新部署（git pull + 重新构建）"
        echo "  logs     - 查看日志（可跟服务名，如: $0 logs backend）"
        echo "  stop     - 停止所有服务"
        echo "  restart  - 重启所有服务（不重新构建）"
        echo "  status   - 查看服务状态"
        ;;
esac
