import "dotenv/config";
import os from "os";
import { disconnectPrisma } from "../lib/prisma";
import { startWebhookWorkerLoop } from "../lib/workers/webhookWorker";

process.on("unhandledRejection", async (reason) => {
  console.error("FATAL unhandled rejection — webhook worker will exit:", reason);
  await disconnectPrisma();
  process.exit(1);
});

async function main() {
  const workerId = process.env.WORKER_ID || `${os.hostname()}-${process.pid}`;
  console.log(`Standalone webhook worker starting: ${workerId}`);
  await startWebhookWorkerLoop({ workerId });
}

main().catch(async (e) => {
  console.error("Webhook worker fatal error:", e);
  await disconnectPrisma();
  process.exit(1);
});
