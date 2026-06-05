export class TimeoutEstimatorService {
  private startTime: number;
  private readonly MAX_DURATION_MS = 280000; // 280 seconds (20s buffer before Vercel's 300s limit)

  constructor() {
    this.startTime = Date.now();
  }

  public getElapsedTimeMs(): number {
    return Date.now() - this.startTime;
  }

  public getRemainingTimeMs(): number {
    return Math.max(0, this.MAX_DURATION_MS - this.getElapsedTimeMs());
  }

  public isTimeExhausted(): boolean {
    return this.getRemainingTimeMs() < 45000; // Bail if less than 45 seconds remaining
  }
}
