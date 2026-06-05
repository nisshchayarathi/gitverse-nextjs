export class ConcurrencyMetrics {
  private activeWorkers: Record<string, number> = {};
  private queuedJobs: Record<string, number> = {};

  incrementActive(queueName: string) {
    this.activeWorkers[queueName] = (this.activeWorkers[queueName] || 0) + 1;
  }

  decrementActive(queueName: string) {
    this.activeWorkers[queueName] = Math.max(0, (this.activeWorkers[queueName] || 0) - 1);
  }

  incrementQueued(queueName: string) {
    this.queuedJobs[queueName] = (this.queuedJobs[queueName] || 0) + 1;
  }

  decrementQueued(queueName: string) {
    this.queuedJobs[queueName] = Math.max(0, (this.queuedJobs[queueName] || 0) - 1);
  }

  getMetrics() {
    return {
      activeWorkers: { ...this.activeWorkers },
      queuedJobs: { ...this.queuedJobs },
      timestamp: new Date().toISOString(),
    };
  }

  logMetrics(queueName: string) {
    console.log(`[ConcurrencyMetrics] Queue: ${queueName} | Active: ${this.activeWorkers[queueName] || 0} | Queued: ${this.queuedJobs[queueName] || 0}`);
  }
}

export const concurrencyMetrics = new ConcurrencyMetrics();
