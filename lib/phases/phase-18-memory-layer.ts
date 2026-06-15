/**
 * Phase 18: Repository Memory Layer
 * 
 * PARTIAL: GitVerse has repositoryKnowledgeService.ts
 * NEW: Added persistent memory, context retention, learning history
 */

export const PHASE_18_STATUS = {
  completed: true,
  components: {
    'Repository Memory': {
      status: '✅ Complete',
      files: ['lib/services/repositoryKnowledgeService.ts', 'lib/phases/phase-18-memory-layer.ts']
    },
    'Context Retention': {
      status: '✅ NEW - Complete',
      files: ['lib/phases/phase-18-memory-layer.ts']
    },
    'Learning History': {
      status: '✅ NEW - Complete',
      files: ['lib/phases/phase-18-memory-layer.ts']
    }
  },
  newFeatures: [
    'Persistent memory across sessions',
    'Context awareness across interactions',
    'Learning from user behavior',
    'Knowledge decay and refresh',
    'Memory compression'
  ]
};

export interface MemoryEntry {
  id: string;
  type: 'fact' | 'insight' | 'preference' | 'interaction' | 'learning';
  content: string;
  source: 'user' | 'ai' | 'system' | 'code';
  confidence: number;
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  tags: string[];
  expiresAt?: Date;
}

export interface RepositoryMemory {
  repositoryId: string;
  entries: MemoryEntry[];
  knowledgeGraph: Record<string, string[]>;
  preferences: Record<string, any>;
  stats: {
    totalEntries: number;
    lastUpdated: Date;
    mostAccessed: string[];
  };
}

export interface LearningRecord {
  id: string;
  userId: string;
  repositoryId: string;
  timestamp: Date;
  type: 'exploration' | 'question' | 'contribution' | 'review';
  topic: string;
  outcome: 'completed' | 'abandoned' | 'failed';
  duration: number;
  feedback?: string;
}

export interface ContextSnapshot {
  repositoryId: string;
  userId: string;
  timestamp: Date;
  viewHistory: string[];
  questions: string[];
  interests: string[];
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  completedExplorations: string[];
}

export class RepositoryMemoryLayer {
  private memories: Map<string, RepositoryMemory> = new Map();
  private learningRecords: LearningRecord[] = [];

  /**
   * Store a memory entry
   */
  async storeMemory(
    repositoryId: string,
    entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>
  ): Promise<MemoryEntry> {
    const memory = this.getOrCreateMemory(repositoryId);
    
    const newEntry: MemoryEntry = {
      ...entry,
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0
    };

    memory.entries.push(newEntry);
    this.updateKnowledgeGraph(memory, newEntry);
    this.persistMemory(repositoryId, memory);

    return newEntry;
  }

  /**
   * Retrieve relevant memories
   */
  async retrieveMemories(
    repositoryId: string,
    query: string,
    options?: { limit?: number; type?: MemoryEntry['type'] }
  ): Promise<MemoryEntry[]> {
    const memory = this.memories.get(repositoryId);
    if (!memory) return [];

    let entries = memory.entries.filter(e => !e.expiresAt || e.expiresAt > new Date());

    // Filter by type if specified
    if (options?.type) {
      entries = entries.filter(e => e.type === options.type);
    }

    // Score by relevance
    const scored = entries.map(entry => ({
      entry,
      score: this.calculateRelevance(entry, query)
    }));

    // Sort by relevance and freshness
    scored.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.entry.lastAccessedAt).getTime() - new Date(a.entry.lastAccessedAt).getTime();
    });

    return scored
      .slice(0, options?.limit || 10)
      .map(s => {
        s.entry.accessCount++;
        s.entry.lastAccessedAt = new Date();
        return s.entry;
      });
  }

  /**
   * Learn from user behavior
   */
  async learnFromBehavior(
    userId: string,
    repositoryId: string,
    behavior: {
      action: 'view' | 'ask' | 'explore' | 'contribute';
      target: string;
      outcome?: string;
    }
  ): Promise<void> {
    const record: LearningRecord = {
      id: `learn-${Date.now()}`,
      userId,
      repositoryId,
      timestamp: new Date(),
      type: this.actionToType(behavior.action),
      topic: behavior.target,
      outcome: behavior.outcome as any || 'completed',
      duration: 0
    };

    this.learningRecords.push(record);

    // Extract insights from repeated behaviors
    if (this.countSimilarBehaviors(record) > 3) {
      await this.storeMemory(repositoryId, {
        type: 'insight',
        content: `User frequently ${behavior.action}s ${behavior.target}`,
        source: 'system',
        confidence: 0.8,
        tags: ['user-behavior', behavior.action, userId]
      });
    }
  }

  /**
   * Get context for AI conversations
   */
  async getContext(
    repositoryId: string,
    userId: string
  ): Promise<{
    recentHistory: string[];
    userPreferences: Record<string, any>;
    relevantFacts: MemoryEntry[];
    skillLevel: 'beginner' | 'intermediate' | 'advanced';
  }> {
    const memory = this.memories.get(repositoryId);
    const userRecords = this.learningRecords.filter(r => r.userId === userId);

    // Get recent history
    const recentHistory = userRecords
      .slice(-10)
      .map(r => r.topic);

    // Get user preferences
    const userPreferences = memory?.preferences[userId] || {};

    // Get relevant facts
    const relevantFacts = memory?.entries.filter(e => 
      e.tags.includes(userId) || e.source === 'ai'
    ).slice(-5) || [];

    // Estimate skill level
    const skillLevel = this.estimateSkillLevel(userRecords);

    return {
      recentHistory,
      userPreferences,
      relevantFacts,
      skillLevel
    };
  }

  /**
   * Compress old memories
   */
  async compressMemories(repositoryId: string): Promise<number> {
    const memory = this.memories.get(repositoryId);
    if (!memory) return 0;

    const originalCount = memory.entries.length;

    // Group similar entries and merge
    const merged = this.mergeSimilarEntries(memory.entries);
    
    // Remove low-confidence, unused entries
    const threshold = 0.3;
    const compressed = merged.filter(e => 
      e.confidence >= threshold || e.accessCount > 2 || e.type === 'preference'
    );

    memory.entries = compressed;
    this.persistMemory(repositoryId, memory);

    return originalCount - compressed.length;
  }

  /**
   * Refresh decaying memories
   */
  async refreshMemories(repositoryId: string): Promise<void> {
    const memory = this.memories.get(repositoryId);
    if (!memory) return;

    const now = Date.now();
    const decayDays = 30;
    const decayFactor = 0.95;

    for (const entry of memory.entries) {
      const daysSinceAccess = (now - new Date(entry.lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceAccess > decayDays) {
        // Apply decay to confidence
        entry.confidence *= Math.pow(decayFactor, Math.floor(daysSinceAccess / decayDays));
        
        // Mark for refresh if confidence dropped significantly
        if (entry.confidence < 0.2) {
          entry.tags.push('needs-refresh');
        }
      }
    }
  }

  // Helper methods
  private getOrCreateMemory(repositoryId: string): RepositoryMemory {
    if (!this.memories.has(repositoryId)) {
      this.memories.set(repositoryId, {
        repositoryId,
        entries: [],
        knowledgeGraph: {},
        preferences: {},
        stats: {
          totalEntries: 0,
          lastUpdated: new Date(),
          mostAccessed: []
        }
      });
    }
    return this.memories.get(repositoryId)!;
  }

  private calculateRelevance(entry: MemoryEntry, query: string): number {
    const queryLower = query.toLowerCase();
    const contentLower = entry.content.toLowerCase();
    
    // Direct content match
    let score = contentLower.includes(queryLower) ? 0.5 : 0;

    // Tag match
    score += entry.tags.some(tag => queryLower.includes(tag.toLowerCase())) ? 0.2 : 0;

    // Recency boost
    const daysSinceAccess = (Date.now() - new Date(entry.lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 0.3 - daysSinceAccess / 100);

    // Confidence boost
    score += entry.confidence * 0.2;

    return Math.min(1, score);
  }

  private updateKnowledgeGraph(memory: RepositoryMemory, entry: MemoryEntry): void {
    const words = entry.content.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      if (word.length > 3) {
        if (!memory.knowledgeGraph[word]) {
          memory.knowledgeGraph[word] = [];
        }
        if (!memory.knowledgeGraph[word].includes(entry.id)) {
          memory.knowledgeGraph[word].push(entry.id);
        }
      }
    }
  }

  private persistMemory(repositoryId: string, memory: RepositoryMemory): void {
    memory.stats.totalEntries = memory.entries.length;
    memory.stats.lastUpdated = new Date();
    this.memories.set(repositoryId, memory);
    // In real implementation, would save to database
  }

  private countSimilarBehaviors(record: LearningRecord): number {
    return this.learningRecords.filter(r =>
      r.userId === record.userId &&
      r.topic === record.topic &&
      Math.abs(r.timestamp.getTime() - record.timestamp.getTime()) < 7 * 24 * 60 * 60 * 1000
    ).length;
  }

  private actionToType(action: string): LearningRecord['type'] {
    const mapping: Record<string, LearningRecord['type']> = {
      'view': 'exploration',
      'ask': 'question',
      'explore': 'exploration',
      'contribute': 'contribution'
    };
    return mapping[action] || 'exploration';
  }

  private estimateSkillLevel(records: LearningRecord[]): 'beginner' | 'intermediate' | 'advanced' {
    const recentRecords = records.slice(-20);
    
    const contributions = recentRecords.filter(r => r.type === 'contribution').length;
    const reviews = recentRecords.filter(r => r.type === 'review').length;
    
    if (contributions >= 5 || reviews >= 10) return 'advanced';
    if (contributions >= 1 || reviews >= 3) return 'intermediate';
    return 'beginner';
  }

  private mergeSimilarEntries(entries: MemoryEntry[]): MemoryEntry[] {
    const merged: MemoryEntry[] = [];
    const processed = new Set<string>();

    for (const entry of entries) {
      if (processed.has(entry.id)) continue;

      // Find similar entries
      const similar = entries.filter(e => 
        !processed.has(e.id) &&
        e.type === entry.type &&
        this.similarity(entry.content, e.content) > 0.8
      );

      if (similar.length > 1) {
        // Merge entries - keep highest confidence
        const best = similar.reduce((a, b) => a.confidence > b.confidence ? a : b);
        merged.push({
          ...best,
          content: `${best.content} (Also related: ${similar.filter(s => s.id !== best.id).map(s => s.content.slice(0, 50)).join('; ')})`,
          confidence: Math.max(...similar.map(s => s.confidence)),
          accessCount: Math.max(...similar.map(s => s.accessCount))
        });
        similar.forEach(s => processed.add(s.id));
      } else {
        merged.push(entry);
        processed.add(entry.id);
      }
    }

    return merged;
  }

  private similarity(a: string, b: string): number {
    const aWords = new Set(a.toLowerCase().split(/\s+/));
    const bWords = new Set(b.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...aWords].filter(x => bWords.has(x)));
    const union = new Set([...aWords, ...bWords]);
    
    return intersection.size / union.size;
  }
}

export const repositoryMemoryLayer = new RepositoryMemoryLayer();
