import { MemoryClient } from 'mem0ai';
import { config } from '../config/index.js';

export interface Mem0MemoryItem {
  id: string;
  memory: string;
  userId?: string;
  score?: number;
  categories?: string[];
  createdAt?: string;
  metadata?: Record<string, any>;
}

export class Mem0Service {
  private client: MemoryClient | null = null;
  private isConfigured = false;
  private searchTimeoutMs = 1200; // Fast timeout to protect voice latency

  constructor(apiKey?: string) {
    const key = apiKey || config.mem0ApiKey;
    if (key && key.trim().length > 0) {
      try {
        this.client = new MemoryClient({ apiKey: key.trim() });
        this.isConfigured = true;
        console.log('[Mem0Service] Initialized Mem0 Cloud Memory client.');
      } catch (err: any) {
        console.warn('[Mem0Service] Initialization failed (degrading to local memory):', err?.message || 'Unknown error');
        this.client = null;
        this.isConfigured = false;
      }
    } else {
      console.log('[Mem0Service] No MEM0_API_KEY provided; using local memory storage.');
    }
  }

  public isAvailable(): boolean {
    return this.isConfigured && this.client !== null;
  }

  /**
   * Strip sensitive tokens, passwords, payment info from text before sending to Mem0
   */
  private sanitizeInput(text: string): string {
    if (!text) return '';
    return text
      .replace(/(?:api[_-]?key|secret|token|password|bearer\s+[a-zA-Z0-9_\-.]+)\s*[:=]\s*['"]?[a-zA-Z0-9_\-.]{8,}['"]?/gi, '[REDACTED_CREDENTIAL]')
      .replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, '[REDACTED_CARD]')
      .trim();
  }

  /**
   * Search relevant user memories with strict timeout protection.
   */
  public async searchMemories(userId: string, query: string, limit = 5): Promise<string[]> {
    if (!this.client || !this.isConfigured || !userId || !query?.trim()) {
      return [];
    }

    const sanitizedQuery = this.sanitizeInput(query);
    if (!sanitizedQuery) return [];

    try {
      const searchPromise = this.client.search(sanitizedQuery, {
        filters: { user_id: userId }
      });

      // Wrap with timeout to guarantee voice TTFT is never blocked
      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Mem0 search timeout exceeded')), this.searchTimeoutMs)
      );

      const response = await Promise.race([searchPromise, timeoutPromise]);
      const results: any[] = Array.isArray(response)
        ? response
        : Array.isArray(response?.results)
        ? response.results
        : [];

      return results
        .slice(0, limit)
        .map((item) => (typeof item === 'string' ? item : item.memory || item.text || ''))
        .filter((mem: string) => mem && typeof mem === 'string' && mem.trim().length > 0);
    } catch (err: any) {
      console.warn(`[Mem0Service] Search failed for user "${userId}" (${err?.message || 'timeout'}); falling back to local memory.`);
      return [];
    }
  }

  /**
   * Store a memory fact or conversation interaction asynchronously.
   * Fire-and-forget or awaited safely without crashing the caller.
   */
  public async addMemory(
    userId: string,
    content: string | Array<{ role: string; content: string }>,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; memoryId?: string; error?: string }> {
    if (!this.client || !this.isConfigured || !userId) {
      return { success: false, error: 'Mem0 not configured or userId missing' };
    }

    try {
      let messagesPayload: Array<{ role: 'user' | 'assistant'; content: string }>;

      if (typeof content === 'string') {
        const clean = this.sanitizeInput(content);
        if (!clean) return { success: false, error: 'Empty content after sanitization' };
        messagesPayload = [{ role: 'user', content: clean }];
      } else if (Array.isArray(content)) {
        messagesPayload = content
          .map((m) => ({
            role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
            content: this.sanitizeInput(m.content)
          }))
          .filter((m) => m.content.length > 0);
        if (messagesPayload.length === 0) return { success: false, error: 'Empty messages payload' };
      } else {
        return { success: false, error: 'Invalid content format' };
      }

      const res: any = await this.client.add(messagesPayload, {
        user_id: userId,
        ...(metadata ? { metadata } : {})
      });

      const memoryId = res?.id || res?.eventId || (Array.isArray(res?.results) && res.results[0]?.id);
      return { success: true, memoryId };
    } catch (err: any) {
      console.warn(`[Mem0Service] Failed to add memory for user "${userId}":`, err?.message || err);
      return { success: false, error: err?.message || 'Add memory failed' };
    }
  }

  /**
   * Get all memories for a user (for settings / debug inspector).
   */
  public async getAllMemories(userId: string): Promise<Mem0MemoryItem[]> {
    if (!this.client || !this.isConfigured || !userId) {
      return [];
    }

    try {
      const getPromise = this.client.getAll({
        filters: { user_id: userId }
      });

      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Mem0 getAll timeout')), 2000)
      );

      const response = await Promise.race([getPromise, timeoutPromise]);
      const results: any[] = Array.isArray(response)
        ? response
        : Array.isArray(response?.results)
        ? response.results
        : [];

      return results.map((item) => ({
        id: item.id || '',
        memory: item.memory || item.text || '',
        userId: item.userId || item.user_id || userId,
        score: item.score,
        categories: item.categories,
        createdAt: item.createdAt || item.created_at,
        metadata: item.metadata
      }));
    } catch (err: any) {
      console.warn(`[Mem0Service] getAllMemories failed for user "${userId}":`, err?.message || err);
      return [];
    }
  }

  /**
   * Delete a specific memory item by ID.
   */
  public async deleteMemory(memoryId: string): Promise<boolean> {
    if (!this.client || !this.isConfigured || !memoryId) {
      return false;
    }

    try {
      await this.client.delete(memoryId);
      return true;
    } catch (err: any) {
      console.warn(`[Mem0Service] Failed to delete memory "${memoryId}":`, err?.message || err);
      return false;
    }
  }
}
