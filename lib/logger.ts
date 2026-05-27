import pino from "pino";

// Note: We intentionally do NOT use `transport: { target: "pino-pretty" }`
// here because Next.js bundles pino's worker thread into a path that Node.js
// cannot resolve at runtime, causing a MODULE_NOT_FOUND crash.
//
// For pretty logs in development, pipe the dev server output:
//   npm run dev 2>&1 | npx pino-pretty
//
// In production, pino's default JSON-to-stdout output works correctly with
// cloud log aggregators (Datadog, CloudWatch, etc.).

/** 
 * Previous Code
const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }),
});
*/

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});
