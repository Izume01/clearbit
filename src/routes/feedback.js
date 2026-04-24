import { listPush } from '../data/redis.js';

/**
 * POST /v1/feedback route handler.
 * Stores feedback for future model training and accuracy improvement.
 */
export async function feedbackRoutes(fastify) {
  fastify.post('/v1/feedback', {
    schema: {
      body: {
        type: 'object',
        required: ['request_id', 'outcome'],
        properties: {
          request_id: {
            type: 'string',
            description: 'The request_id from the original /v1/risk response',
          },
          outcome: {
            type: 'string',
            enum: ['false_positive', 'confirmed_fraud', 'unsure'],
            description: 'What actually happened with this user',
          },
          notes: {
            type: 'string',
            description: 'Optional context about the feedback',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { request_id, outcome, notes } = request.body;

      const record = {
        request_id,
        outcome,
        notes: notes || null,
        submitted_at: new Date().toISOString(),
      };

      // Store in Redis list for persistence
      await listPush('feedback:records', record);

      // Also store by request_id for quick lookup
      await listPush(`feedback:${request_id}`, record);

      return reply.send({
        status: 'ok',
        message: `Feedback recorded for ${request_id}`,
      });
    },
  });
}
