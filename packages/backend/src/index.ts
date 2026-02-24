import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { registry } from './services/ai/registry';
import { FaruiProvider } from './services/ai/farui';
import { QwenProvider } from './services/ai/qwen';
import aiRoutes from './routes/ai';
import documentRoutes from './routes/documents';
import uploadRoutes from './routes/uploads';
import libraryRoutes from './routes/library';

// 初始化 AI Providers
registry.register(new FaruiProvider());
registry.register(new QwenProvider('qwen3.5-plus', 'qwen3.5-plus', '通义千问 3.5 Plus'));
registry.register(new QwenProvider('qwen-long', 'qwen-long', '通义千问 Long'));

// 创建 Hono 应用
const app = new Hono();

// 中间件
app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5174'],
  credentials: true,
}));

// 健康检查
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 路由挂载
app.route('/api/ai', aiRoutes);
app.route('/api/documents', documentRoutes);
app.route('/api/documents', uploadRoutes);
app.route('/api/library', libraryRoutes);

// 启动服务
const port = Number(process.env.PORT) || 3000;
console.log(`🚀 Server starting on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
