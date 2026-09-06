import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { MemoryFact, ReminderItem, ConversationTurn } from '../state/types.js';
import { Mem0Service } from './mem0-service.js';

interface StorageSchema {
  factsByUser: Record<string, MemoryFact[]>;
  remindersByUser: Record<string, ReminderItem[]>;
}

export class MemoryManager {
  private storagePath: string;
  private memoryData: StorageSchema = { factsByUser: {}, remindersByUser: {} };
  private shortTermTurns: ConversationTurn[] = [];
  private readonly maxShortTermTurns = 12;
  public mem0Service: Mem0Service;

  constructor(storagePath?: string, mem0Service?: Mem0Service) {
    this.storagePath = storagePath || config.memoryStoragePath;
    this.mem0Service = mem0Service || new Mem0Service();
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf-8');
        this.memoryData = JSON.parse(raw);
      } else {
        // Seed initial demo cross-session memories for default demo user
        this.memoryData = {
          factsByUser: {
            'default-user': [
              {
                id: uuidv4(),
                userId: 'default-user',
                fact: 'Final-year computer science student prepping for upcoming tech interviews',
                category: 'education',
                confidence: 0.95,
                createdAt: Date.now() - 86400000 * 2, // 2 days ago
                lastMentionedAt: Date.now() - 86400000 * 2
              },
              {
                id: uuidv4(),
                userId: 'default-user',
                fact: 'Working on a distributed voice agent project with real-time barge-in',
                category: 'project',
                confidence: 0.9,
                createdAt: Date.now() - 86400000 * 1,
                lastMentionedAt: Date.now() - 86400000 * 1
              },
              {
                id: uuidv4(),
                userId: 'default-user',
                fact: 'Prefers dark mode and loves iced coffee while coding late at night',
                category: 'preference',
                confidence: 0.85,
                createdAt: Date.now() - 86400000 * 3,
                lastMentionedAt: Date.now() - 86400000 * 3
              }
            ]
          },
          remindersByUser: {
            'default-user': [
              {
                id: uuidv4(),
                userId: 'default-user',
                text: 'Submit final project report to professor by 5 PM',
                timeString: '5:00 PM today',
                createdAt: Date.now() - 3600000 * 4,
                status: 'pending'
              }
            ]
          }
        };
        this.saveToDisk();
      }
    } catch (err) {
      console.warn('[MemoryManager] Error loading storage, using in-memory schema:', err);
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storagePath, JSON.stringify(this.memoryData, null, 2), 'utf-8');
    } catch (err) {
      console.error('[MemoryManager] Failed to persist memory to disk:', err);
    }
  }

  // Short-Term Memory Methods
  public addTurn(turn: ConversationTurn): void {
    this.shortTermTurns.push(turn);
    if (this.shortTermTurns.length > this.maxShortTermTurns) {
      this.shortTermTurns.shift();
    }
  }

  public getRecentTurns(): ConversationTurn[] {
    return [...this.shortTermTurns];
  }

  public clearShortTerm(): void {
    this.shortTermTurns = [];
  }

  // Long-Term Memory Methods
  public addFact(userId: string, fact: string, category: MemoryFact['category'] = 'general'): MemoryFact {
    if (!this.memoryData.factsByUser[userId]) {
      this.memoryData.factsByUser[userId] = [];
    }

    // Check if duplicate fact exists
    const existing = this.memoryData.factsByUser[userId].find(
      f => f.fact.toLowerCase().includes(fact.toLowerCase()) || fact.toLowerCase().includes(f.fact.toLowerCase())
    );

    if (existing) {
      existing.lastMentionedAt = Date.now();
      this.saveToDisk();
      // Sync update to Mem0 asynchronously in background
      if (this.mem0Service.isAvailable()) {
        this.mem0Service.addMemory(userId, fact, { category }).catch(() => {});
      }
      return existing;
    }

    const newFact: MemoryFact = {
      id: uuidv4(),
      userId,
      fact,
      category,
      confidence: 0.9,
      createdAt: Date.now(),
      lastMentionedAt: Date.now()
    };

    this.memoryData.factsByUser[userId].push(newFact);
    this.saveToDisk();

    // Sync new fact to Mem0 asynchronously in background
    if (this.mem0Service.isAvailable()) {
      this.mem0Service.addMemory(userId, fact, { category }).catch(() => {});
    }

    return newFact;
  }

  public getFacts(userId = 'default-user'): MemoryFact[] {
    return this.memoryData.factsByUser[userId] || [];
  }

  /**
   * Search semantic memories from Mem0 for a specific user
   */
  public async searchMem0Memories(userId: string, query: string, limit = 4): Promise<string[]> {
    if (!this.mem0Service.isAvailable()) {
      return [];
    }
    return this.mem0Service.searchMemories(userId, query, limit);
  }

  /**
   * Directly add a long-term preference or fact into Mem0 for a specific user
   */
  public async addMem0Memory(userId: string, text: string, metadata?: Record<string, any>): Promise<any> {
    if (!this.mem0Service.isAvailable()) {
      return { success: false, error: 'Mem0 not configured' };
    }
    return this.mem0Service.addMemory(userId, text, metadata);
  }

  public addReminder(userId: string, text: string, timeString: string): ReminderItem {
    if (!this.memoryData.remindersByUser[userId]) {
      this.memoryData.remindersByUser[userId] = [];
    }

    const reminder: ReminderItem = {
      id: uuidv4(),
      userId,
      text,
      timeString,
      createdAt: Date.now(),
      status: 'pending'
    };

    this.memoryData.remindersByUser[userId].push(reminder);
    this.saveToDisk();
    return reminder;
  }

  public getReminders(userId = 'default-user'): ReminderItem[] {
    return this.memoryData.remindersByUser[userId] || [];
  }

  /**
   * Find contextually relevant long-term memory facts for current conversation context.
   * Only surfaces facts when relevant keywords / semantic anchors are triggered.
   */
  public findContextualRecall(userId = 'default-user', currentUtterance: string): MemoryFact | null {
    const facts = this.getFacts(userId);
    const lower = currentUtterance.toLowerCase();

    // Contextual matching heuristics
    if (/\b(tired|exhausted|burnout|stressed|prep|prepare|interview|placement|study|exam)\b/i.test(lower)) {
      const interviewFact = facts.find(f => f.fact.toLowerCase().includes('interview') || f.fact.toLowerCase().includes('student'));
      if (interviewFact) return interviewFact;
    }

    if (/\b(project|build|deploy|barge-in|voice|latency|coding|code)\b/i.test(lower)) {
      const projectFact = facts.find(f => f.fact.toLowerCase().includes('project') || f.fact.toLowerCase().includes('agent'));
      if (projectFact) return projectFact;
    }

    if (/\b(coffee|drink|night|late|sleep|setup)\b/i.test(lower)) {
      const prefFact = facts.find(f => f.fact.toLowerCase().includes('coffee') || f.category === 'preference');
      if (prefFact) return prefFact;
    }

    return null;
  }

  public getAllDataForInspector(userId = 'default-user') {
    return {
      shortTermTurnCount: this.shortTermTurns.length,
      recentTurns: this.shortTermTurns,
      longTermFacts: this.getFacts(userId),
      reminders: this.getReminders(userId),
      mem0Configured: this.mem0Service.isAvailable()
    };
  }

  public async getInspectorDataWithMem0(userId = 'default-user') {
    const base = this.getAllDataForInspector(userId);
    let mem0Items: any[] = [];
    if (this.mem0Service.isAvailable()) {
      mem0Items = await this.mem0Service.getAllMemories(userId);
    }
    return {
      ...base,
      mem0Memories: mem0Items
    };
  }
}
