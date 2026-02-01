import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { env } from '../env';

const UPDATE_SCRIPT = process.env.ADMIN_UPDATE_SCRIPT ?? '/opt/htown/scripts/update.sh';

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

type GithubPayload = {
  ref?: string;
  repository?: {
    full_name?: string;
  };
};

export async function registerWebhookRoutes(app: FastifyInstance) {
  await app.register(async (instance) => {
    instance.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (request, body, done) => {
        done(null, body);
      }
    );

    instance.post('/webhooks/github', async (request, reply) => {
      if (!env.webhookSecret) {
        return reply.code(503).send({ error: 'WEBHOOK_DISABLED' });
      }

      const event = request.headers['x-github-event'];
      if (event !== 'push') {
        return reply.code(202).send({ ok: true, ignored: 'event' });
      }

      const signatureHeader = request.headers['x-hub-signature-256'];
      if (typeof signatureHeader !== 'string') {
        return reply.code(400).send({ error: 'MISSING_SIGNATURE' });
      }

      const rawBody = (request.body as Buffer).toString('utf8');
      const expected = `sha256=${crypto.createHmac('sha256', env.webhookSecret).update(rawBody).digest('hex')}`;
      if (!timingSafeEqual(expected, signatureHeader)) {
        return reply.code(401).send({ error: 'INVALID_SIGNATURE' });
      }

      let payload: GithubPayload;
      try {
        payload = JSON.parse(rawBody) as GithubPayload;
      } catch {
        return reply.code(400).send({ error: 'INVALID_JSON' });
      }

      if (env.webhookRepo && payload.repository?.full_name !== env.webhookRepo) {
        return reply.code(202).send({ ok: true, ignored: 'repo' });
      }

      if (env.webhookBranch && payload.ref !== env.webhookBranch) {
        return reply.code(202).send({ ok: true, ignored: 'branch' });
      }

      const child = spawn(UPDATE_SCRIPT, [], { detached: true, stdio: 'ignore' });
      child.unref();
      return reply.send({ ok: true, started: true });
    });
  });
}
