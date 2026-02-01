import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './env';
import { logger } from './logging/logger';
import { metrics } from './services/metrics';
import './types';
import { registerAuthRoutes } from './routes/auth';
import { registerHealthRoutes } from './routes/health';
import { registerLogRoutes } from './routes/logs';
import { registerConfigRoutes } from './routes/config';
import { registerPlayerRoutes } from './routes/players';
import { registerRoomRoutes } from './routes/rooms';
import { registerMatchRoutes } from './routes/matches';
import { registerAuditRoutes } from './routes/audit';
import { registerAdminUserRoutes } from './routes/adminUsers';
import { registerUpdateRoutes } from './routes/update';
import { registerWebhookRoutes } from './routes/webhooks';
import { registerDataRoutes } from './routes/data';
import { registerAssetRoutes } from './routes/assets';

export async function buildServer() {
  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: env.nodeEnv === 'production' ? env.corsOrigin : true,
    credentials: true
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'HTOWN Admin API',
        version: '0.1.0'
      }
    }
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs'
  });

  app.addHook('onRequest', async (request) => {
    (request as any).startTime = Date.now();
  });

  app.addHook('onResponse', async (request, reply) => {
    const start = (request as any).startTime ?? Date.now();
    const duration = Date.now() - start;
    const isError = reply.statusCode >= 400;
    metrics.record(isError);
    const sanitizedUrl = request.url.replace(/token=[^&]+/g, 'token=REDACTED');
    logger.log('info', 'http.request', {
      method: request.method,
      url: sanitizedUrl,
      status: reply.statusCode,
      duration
    });
  });

  app.setErrorHandler((error, _request, reply) => {
    if ((error as any).name === 'ZodError') {
      logger.log('warn', 'http.validation', { message: error.message });
      reply.code(400).send({ error: 'INVALID_INPUT', details: error.message });
      return;
    }
    logger.log('error', 'http.error', { message: error.message, stack: error.stack });
    reply.code(500).send({ error: 'INTERNAL_SERVER_ERROR' });
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerLogRoutes(app);
  await registerConfigRoutes(app);
  await registerPlayerRoutes(app);
  await registerRoomRoutes(app);
  await registerMatchRoutes(app);
  await registerAuditRoutes(app);
  await registerAdminUserRoutes(app);
  await registerUpdateRoutes(app);
  await registerWebhookRoutes(app);
  await registerDataRoutes(app);
  await registerAssetRoutes(app);

  return app;
}
