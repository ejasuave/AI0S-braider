import type { FastifyPluginAsync } from 'fastify';
import {
  exampleDelayedJobRequestSchema,
  type ExampleDelayedJobResponse,
  type ExampleJobEnqueueResponse,
  type ExampleJobStatusResponse,
} from '@project-braids/shared-types/api';
import { ApiError } from '../../lib/errors.js';
import { sendApiError, sendData } from '../../lib/http.js';
import { JOB_NAMES, getSystemQueue } from '../../lib/queue.js';
import { prisma } from '../../lib/db.js';
import { buildOpsStatus, requireOpsToken } from './ops.js';

export const systemRoutes: FastifyPluginAsync = async (app) => {
  app.get('/ops-status', { preHandler: [requireOpsToken] }, async (_request, reply) => {
    sendData(reply, buildOpsStatus());
  });

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

  app.post('/example-delayed-job', async (request, reply) => {
    try {
      const body = exampleDelayedJobRequestSchema.parse(request.body ?? {});
      const queue = getSystemQueue();
      const job = await queue.add(
        JOB_NAMES.EXAMPLE_DELAYED,
        { message: body.message },
        { delay: body.delayMs },
      );

      if (!job.id) {
        throw ApiError.internal('Failed to enqueue delayed job');
      }

      const response: ExampleDelayedJobResponse = {
        jobId: job.id,
        delayMs: body.delayMs,
        status: 'queued',
      };
      sendData(reply, response, 202);
    } catch (error) {
      if (error instanceof ApiError) {
        sendApiError(reply, error);
        return;
      }
      request.log.error({ err: error }, 'Failed to enqueue delayed example job');
      sendApiError(reply, ApiError.serviceUnavailable('Job queue unavailable'));
    }
  });
};
