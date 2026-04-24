import { assessRisk } from '../services/risk.js';

/**
 * GET /v1/risk route handler.
 * Query params: ip (required), email (required)
 */
export async function riskRoutes(fastify) {
  fastify.get('/v1/risk', {
    schema: {
      querystring: {
        type: 'object',
        required: ['ip', 'email'],
        properties: {
          ip: {
            type: 'string',
            description: 'IP address to check',
          },
          email: {
            type: 'string',
            description: 'Email address to check',
          },
        },
      },
      // No response schema — let the full risk object pass through unmodified
    },
    handler: async (request, reply) => {
      const { ip, email } = request.query;

      // Basic IP format validation
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
      if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
        return reply.status(400).send({
          error: 'Invalid IP address format',
          message: 'Provide a valid IPv4 or IPv6 address',
        });
      }

      const result = await assessRisk(ip, email);
      return reply.send(result);
    },
  });
}
