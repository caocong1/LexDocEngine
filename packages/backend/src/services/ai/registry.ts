import type { AIProvider } from './provider';

// Provider 注册表
export class AIProviderRegistry {
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

// 全局单例
export const registry = new AIProviderRegistry();
