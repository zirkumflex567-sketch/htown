import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { createServer } from 'http';
import { Server as ColyseusServer, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './rooms/GameRoom.js';
import { DatabaseLayer } from './db.js';
import { createAccessToken, createRefreshToken, getRefreshExpiry, verifyToken } from './auth.js';

const app = express();
const httpServer = createServer(app);
const db = new DatabaseLayer();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
});

app.post('/auth/register', authLimiter, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }
  const existing = db.getUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  const userId = nanoid();
  db.createUser(userId, email, hash);
  const accessToken = createAccessToken({ sub: userId, email });
  const refreshToken = createRefreshToken({ sub: userId, email });
  db.saveRefreshToken(refreshToken, userId, getRefreshExpiry());
  res.json({ accessToken, refreshToken });
});

app.post('/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }
  const user = db.getUserByEmail(email);
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const accessToken = createAccessToken({ sub: user.id, email: user.email });
  const refreshToken = createRefreshToken({ sub: user.id, email: user.email });
  db.saveRefreshToken(refreshToken, user.id, getRefreshExpiry());
  res.json({ accessToken, refreshToken });
});

app.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }
  const stored = db.consumeRefreshToken(refreshToken);
  if (!stored || stored.expiresAt < Date.now()) {
    res.status(401).json({ error: 'Refresh token invalid' });
    return;
  }
  try {
    const payload = verifyToken(refreshToken);
    const accessToken = createAccessToken({ sub: payload.sub, email: payload.email });
    const newRefreshToken = createRefreshToken({ sub: payload.sub, email: payload.email });
    db.saveRefreshToken(newRefreshToken, payload.sub, getRefreshExpiry());
    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(401).json({ error: 'Refresh token invalid' });
  }
});

app.post('/auth/logout', (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    db.consumeRefreshToken(refreshToken);
  }
  res.json({ ok: true });
});

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  const token = authHeader.slice('Bearer '.length);
  try {
    const payload = verifyToken(token);
    res.locals.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.get('/leaderboard/top', (_req, res) => {
  res.json({ entries: db.listTopScores(50) });
});

app.get('/leaderboard/me', requireAuth, (req, res) => {
  const user = db.getUserById(res.locals.user.sub as string);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    bestScore: user.bestScore,
    totalRuns: user.totalRuns,
    lastRun: user.lastRunJson ? JSON.parse(user.lastRunJson) : null,
  });
});

app.post('/runs/submit', requireAuth, (req, res) => {
  const { score, summary } = req.body as { score?: number; summary?: Record<string, unknown> };
  if (typeof score !== 'number') {
    res.status(400).json({ error: 'Score required' });
    return;
  }
  db.createRun(nanoid(), res.locals.user.sub as string, score, summary ?? {});
  res.json({ ok: true });
});

const colyseusServer = new ColyseusServer({
  transport: new WebSocketTransport({ server: httpServer }),
});

colyseusServer.define('game', GameRoom);

app.post('/matchmaking/create', requireAuth, async (_req, res) => {
  const room = await matchMaker.createRoom('game', {});
  res.json({ roomId: room.roomId, roomCode: room.roomId.slice(0, 6) });
});

app.get('/matchmaking/rooms', async (_req, res) => {
  const rooms = await matchMaker.query({ name: 'game' });
  res.json(
    rooms.map((room) => ({
      roomId: room.roomId,
      roomCode: room.roomId.slice(0, 6),
      clients: room.clients,
      maxClients: room.maxClients,
    })),
  );
});

const port = Number(process.env.PORT || 2567);
httpServer.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
