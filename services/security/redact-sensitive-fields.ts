export class RedactSensitiveFields {
  private static sensitiveKeys = [
    "accesstoken",
    "refreshtoken",
    "passwordhash",
    "encryptedtoken",
    "installationtoken",
    "token",
    "secret",
    "password",
    "key",
    "privatekey"
  ];

  /**
   * Deeply traverses an object or array and removes/redacts sensitive keys.
   */
  public static redact<T = any>(obj: any): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redact(item)) as any;
    }

    if (typeof obj === "object") {
      // Handle Date or other non-plain objects
      if (obj instanceof Date) {
        return obj as any;
      }

      const redactedObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        // Strip or redact sensitive keys
        if (this.sensitiveKeys.some(sk => lowerKey.includes(sk))) {
          // Completely drop the key from being returned
          continue;
        }

        redactedObj[key] = this.redact(value);
      }
      return redactedObj as T;
    }

    return obj;
  }
}
