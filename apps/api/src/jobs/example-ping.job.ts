import type { Job } from 'bullmq';
import { prisma } from '../lib/db.js';

export type ExamplePingJobData = {
  message: string;
};

export type ExamplePingJobResult = {
  echoed: string;
  completedAt: string;
};

export async function processExamplePingJob(
  job: Job<ExamplePingJobData>,
): Promise<ExamplePingJobResult> {
  const run = await prisma.exampleJobRun.upsert({
    where: { bullJobId: job.id ?? 'unknown' },
    update: { status: 'active' },
    create: {
      bullJobId: job.id ?? 'unknown',
      status: 'active',
    },
  });

  const result: ExamplePingJobResult = {
    echoed: job.data.message,
    completedAt: new Date().toISOString(),
  };

  await prisma.exampleJobRun.update({
    where: { id: run.id },
    data: {
      status: 'completed',
      result: JSON.stringify(result),
      completedAt: new Date(),
    },
  });

  return result;
}
