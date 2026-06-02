import { concurrencyMetrics } from "../monitoring/concurrencyMetrics";

type AsyncFunction<T> = () => Promise<T>;

export class ConcurrencyLimiter {
  private queue: Array<{
    fn: AsyncFunction<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private activeCount = 0;

  constructor(public readonly name: string, public readonly maxConcurrency: number) {}

  public async add<T>(fn: AsyncFunction<T>): Promise<T> {
    concurrencyMetrics.incrementQueued(this.name);
    
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    concurrencyMetrics.decrementQueued(this.name);
    concurrencyMetrics.incrementActive(this.name);
    this.activeCount++;
    concurrencyMetrics.logMetrics(this.name);

    try {
      const result = await job.fn();
      job.resolve(result);
    } catch (error) {
      job.reject(error);
    } finally {
      this.activeCount--;
      concurrencyMetrics.decrementActive(this.name);
      concurrencyMetrics.logMetrics(this.name);
      this.processQueue();
    }
  }

  public getStatus() {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      max: this.maxConcurrency
    };
  }
}

// Global limiters based on env variables or defaults
export const repoSyncLimiter = new ConcurrencyLimiter(
  "RepositorySync", 
  Number(process.env.MAX_REPO_SYNC_CONCURRENCY) || 5
);

export const ragIndexLimiter = new ConcurrencyLimiter(
  "RagIndexing", 
  Number(process.env.MAX_RAG_CONCURRENCY) || 3
);
