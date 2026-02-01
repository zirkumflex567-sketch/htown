import express from 'express';
import http from 'http';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './rooms/GameRoom';
import { env } from './env';
import { initDb, getLeaderboard } from './db';
import { login, register, refresh, logout, verifyAccessToken } from './auth';
import { requireAuth, type AuthedRequest } from './middleware/authMiddleware';

initDb();

const app = express();
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());

const authLimiter = rateLimit({ windowMs: 60_000, limit: 20 });

app.post('/auth/register', authLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }
  try {
    const tokens = await register(email, password);
    return res.json(tokens);
  } catch (error) {
    return res.status(409).json({ error: (error as Error).message });
  }
});

app.post('/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }
  try {
    const tokens = await login(email, password);
    return res.json(tokens);
  } catch (error) {
    return res.status(401).json({ error: (error as Error).message });
  }
});

app.post('/auth/refresh', authLimiter, (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }
  try {
    const tokens = refresh(refreshToken);
    return res.json(tokens);
  } catch (error) {
    return res.status(401).json({ error: (error as Error).message });
  }
});

app.post('/auth/logout', requireAuth, (req: AuthedRequest, res) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  logout(req.userId);
  return res.json({ ok: true });
});

app.get('/leaderboard/top', (_req, res) => {
  const leaderboard = getLeaderboard(50);
  return res.json({ leaderboard });
});

app.get('/leaderboard/me', requireAuth, (req: AuthedRequest, res) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const payload = verifyAccessToken(header.split(' ')[1]);
    const leaderboard = getLeaderboard(50);
    const me = leaderboard.find((entry) => entry.id === payload.sub);
    return res.json({ me });
  } catch {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
});

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server })
});

gameServer.define('game', GameRoom).enableRealtimeListing();

const roomCodes = new Map<string, string>();

app.post('/matchmake/create', requireAuth, async (_req: AuthedRequest, res) => {
  const room = await gameServer.create('game', {});
  const code = Math.random().toString(36).slice(2, 6).toUpperCase();
  roomCodes.set(code, room.roomId);
  return res.json({ code, roomId: room.roomId });
});

app.post('/matchmake/join', requireAuth, (req: AuthedRequest, res) => {
  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ error: 'INVALID_INPUT' });
  const roomId = roomCodes.get(code.toUpperCase());
  if (!roomId) return res.status(404).json({ error: 'ROOM_NOT_FOUND' });
  return res.json({ roomId });
});

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${env.port}`);
});
