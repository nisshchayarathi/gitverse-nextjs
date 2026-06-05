export async function withDbRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      // Only retry on transient DB errors (e.g., connection pool timeouts, deadlocks)
      const isTransient =
        error?.code === 'P2024' || // Connection pool timeout
        error?.code === 'P2034' || // Transaction conflict
        error?.message?.includes('deadlock') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('socket');

      if (!isTransient || attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[DB Retry] Transient error encountered. Retrying ${attempt}/${maxRetries} in ${delay}ms...`, error?.message);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
