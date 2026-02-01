import 'fastify';
import { AuthPayload } from './services/auth';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthPayload;
  }
}
