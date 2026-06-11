export function redactSecrets(text: string) {
    let count = 0;

    const patterns = [
        /sk-[A-Za-z0-9]+/g,                   // OpenAI keys
        /ghp_[A-Za-z0-9]+/g,                  // GitHub token
        /AIza[A-Za-z0-9_-]+/g,               // Google API key
        /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g
    ];

    let redacted = text;

    patterns.forEach((pattern) => {
        const matches = redacted.match(pattern);

        if (matches) {
            count += matches.length;
            redacted = redacted.replace(pattern, "[REDACTED]");
        }
    });

    return {
        redacted,
        count
    };
}