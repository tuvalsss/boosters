// Worker entrypoint. Phase 1: connects to Redis, asserts safe mode, and idles.
// Real processors are registered in later phases.

import { assertSafeMode, bootstrapEnv } from '@boosters/config';
import { Redis } from 'ioredis';
import { QUEUE_NAMES } from './queues.js';

async function main() {
  const env = bootstrapEnv();
  assertSafeMode(env);

  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  await connection.ping();

  console.log(
    `[worker] connected to Redis; registered queues: ${Object.values(QUEUE_NAMES).join(', ')} (cluster=${env.SOLANA_CLUSTER})`,
  );

  const shutdown = async () => {
    await connection.quit();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
