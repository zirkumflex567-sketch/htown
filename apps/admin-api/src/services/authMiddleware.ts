import { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from './auth';
import { hasPermission } from '../rbac/permissions';
import { Permission } from '@htown/admin-shared';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'UNAUTHORIZED' });
    return;
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyAccessToken(token);
    request.user = payload;
  } catch {
    reply.code(401).send({ error: 'UNAUTHORIZED' });
    return;
  }
}

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      reply.code(401).send({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!hasPermission(request.user.role, permission)) {
      reply.code(403).send({ error: 'FORBIDDEN' });
      return;
    }
  };
}
