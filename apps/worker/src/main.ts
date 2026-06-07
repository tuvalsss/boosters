// Boosters background worker. A real BullMQ service: it schedules a repeatable
// "sweep" job and processes it, running DB maintenance (expire stale buyback
// quotes + abandoned on-ramps) and emitting a treasury float-floor alert.

import { assertSafeMode, bootstrapEnv } from '@boosters/config';
import { prisma } from '@boosters/db';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUE_NAMES } from './queues.js';
import {
  expireBuybackQuotes,
  expireStaleOnramps,
  treasuryBalanceUsdc,
} from './jobs/maintenance.js';

const SWEEP_INTERVAL_MS = 60_000;

async function main() {
  const env = bootstrapEnv();
  assertSafeMode(env);

  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  await connection.ping();
  // BullMQ bundles its own ioredis types; reuse our instance across queue/worker.
  const bull = connection as unknown as ConnectionOptions;

  const queue = new Queue(QUEUE_NAMES.FMV_REFRESH, { connection: bull });
  // Idempotent repeatable schedule (BullMQ de-dupes by jobId/pattern).
  await queue.add(
    'sweep',
    {},
    { repeat: { every: SWEEP_INTERVAL_MS }, removeOnComplete: 100, removeOnFail: 100 },
  );

  const worker = new Worker(
    QUEUE_NAMES.FMV_REFRESH,
    async () => {
      const expiredQuotes = await expireBuybackQuotes(prisma);
      const failedOnramps = await expireStaleOnramps(prisma);
      const treasury = await treasuryBalanceUsdc(prisma);
      if (treasury < env.BUYBACK_FLOAT_FLOOR_USDC) {
        console.warn(
          `[worker] ALERT: treasury ${treasury} USDC is below the float floor ${env.BUYBACK_FLOAT_FLOOR_USDC}`,
        );
      }
      return { expiredQuotes, failedOnramps, treasury };
    },
    { connection: bull },
  );

  worker.on('completed', (job, result) => {
    if (result && (result.expiredQuotes || result.failedOnramps)) {
      console.log(
        `[worker] sweep: expired ${result.expiredQuotes} quote(s), failed ${result.failedOnramps} on-ramp(s)`,
      );
    }
  });
  worker.on('failed', (job, err) => console.error(`[worker] job ${job?.id} failed:`, err.message));

  console.log(
    `[worker] running; sweeping every ${SWEEP_INTERVAL_MS / 1000}s (cluster=${env.SOLANA_CLUSTER})`,
  );

  const shutdown = async () => {
    await worker.close();
    await queue.close();
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
