import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// 数据库连接配置
const connectionString = process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER || 'lexdoc'}:${process.env.DB_PASSWORD || 'lexdoc_dev'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'lexdoc_db'}`;

// 创建 postgres 客户端
const client = postgres(connectionString);

// 创建 drizzle 实例
export const db = drizzle(client, { schema });

// 导出 schema
export * from './schema';
