import type { FastifyPluginAsync } from 'fastify';
import type {
  ExampleJobEnqueueResponse,
  ExampleJobStatusResponse,
} from '@project-braids/shared-types/api';
import { ApiError } from '../../lib/errors.js';
import { sendApiError, sendData } from '../../lib/http.js';
import { JOB_NAMES, getSystemQueue } from '../../lib/queue.js';
import { prisma } from '../../lib/db.js';

export const systemRoutes: FastifyPluginAsync = async (app) => {
  app.post('/example-job', async (request, reply) => {
    try {
      const queue = getSystemQueue();
      const job = await queue.add(JOB_NAMES.EXAMPLE_PING, {
        message: 'chapter-2-example',
      });

      if (!job.id) {
        throw ApiError.internal('Failed to enqueue job');
      }

      await prisma.exampleJobRun.create({
        data: {
          bullJobId: job.id,
          status: 'queued',
        },
      });

      const body: ExampleJobEnqueueResponse = {
        jobId: job.id,
        status: 'queued',
      };
      sendData(reply, body, 202);
    } catch (error) {
      request.log.error({ err: error }, 'Failed to enqueue example job');
      sendApiError(reply, ApiError.serviceUnavailable('Job queue unavailable'));
    }
  });

  app.get<{ Params: { jobId: string } }>('/example-job/:jobId', async (request, reply) => {
    const { jobId } = request.params;

    const queue = getSystemQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      sendApiError(reply, ApiError.notFound('Job not found'));
      return;
    }

    const state = await job.getState();
    const run = await prisma.exampleJobRun.findUnique({
      where: { bullJobId: jobId },
    });

    const body: ExampleJobStatusResponse = {
      jobId,
      status: state as ExampleJobStatusResponse['status'],
      result: run?.result ?? undefined,
    };
    sendData(reply, body);
  });
};
