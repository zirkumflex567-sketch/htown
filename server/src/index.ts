import express from 'express';
import http from 'http';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './rooms/GameRoom';
import { env } from './env';
import { initDb, getLeaderboard, getUserStats } from './db';
import { login, register, refresh, logout, verifyAccessToken } from './auth';
import { requireAuth, type AuthedRequest } from './middleware/authMiddleware';

initDb();

const app = express();
const isDev = process.env.NODE_ENV !== 'production';
const adminToken = env.adminToken;
const logBuffer: Array<{ id: number; ts: string; level: string; message: string }> = [];
let logId = 0;
let acceptingPlayers = true;

const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

const formatLogValue = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack ?? value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const pushLog = (level: 'log' | 'info' | 'warn' | 'error', args: unknown[]) => {
  logId += 1;
  logBuffer.push({
    id: logId,
    ts: new Date().toISOString(),
    level,
    message: args.map(formatLogValue).join(' ')
  });
  if (logBuffer.length > 300) logBuffer.shift();
};

(['log', 'info', 'warn', 'error'] as const).forEach((level) => {
  console[level] = (...args: unknown[]) => {
    pushLog(level, args);
    originalConsole[level](...args);
  };
});

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!adminToken && !isDev) {
    return res.status(503).json({ error: 'ADMIN_DISABLED' });
  }
  if (!adminToken && isDev) {
    return next();
  }
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : '';
  const token =
    bearer ||
    (typeof req.query.token === 'string' ? req.query.token : '') ||
    (typeof req.headers['x-admin-token'] === 'string' ? req.headers['x-admin-token'] : '');
  if (!token || token !== adminToken) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
  return next();
};

const setAcceptingPlayers = (value: boolean) => {
  acceptingPlayers = value;
  GameRoom.setAcceptingPlayers(value);
};

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (isDev) return callback(null, true);
      if (origin === env.clientUrl) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    }
  })
);
app.use(express.json());

const authLimiter = rateLimit({ windowMs: 60_000, limit: 20 });

app.get('/admin', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>HTOWN Server Control</title>
      <style>
        :root {
          color-scheme: dark;
          font-family: 'Rajdhani', system-ui, sans-serif;
          background: #0b0f1a;
          color: #e6f0ff;
        }
        body { margin: 0; padding: 20px; background: radial-gradient(circle at 20% 10%, rgba(60,90,140,.35), transparent 55%), #0b0f1a; }
        .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
        .card { background: rgba(14,20,34,.92); border: 1px solid rgba(120,150,200,.25); border-radius: 14px; padding: 14px; box-shadow: 0 12px 28px rgba(0,0,0,.35); }
        h1 { margin: 0 0 10px; letter-spacing: 0.12em; text-transform: uppercase; font-size: 1.1rem; }
        h2 { margin: 0 0 10px; font-size: .9rem; text-transform: uppercase; letter-spacing: .12em; opacity: .75; }
        .row { display: flex; justify-content: space-between; gap: 12px; font-size: .85rem; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
        .row:last-child { border-bottom: none; }
        .pill { padding: 4px 10px; border-radius: 999px; font-size: .7rem; letter-spacing: .12em; text-transform: uppercase; border: 1px solid rgba(120,150,200,.35); }
        .pill.ok { color: #7dffb3; border-color: rgba(120,255,190,.4); }
        .pill.off { color: #ff9c9c; border-color: rgba(255,150,150,.4); }
        button { background: #1a2a46; color: #e6f0ff; border: 1px solid rgba(120,150,200,.35); padding: 8px 12px; border-radius: 10px; cursor: pointer; font-weight: 600; letter-spacing: .06em; }
        button:hover { border-color: rgba(120,200,255,.6); }
        input { width: 100%; padding: 8px; border-radius: 10px; border: 1px solid rgba(120,150,200,.35); background: rgba(8,12,22,.8); color: #e6f0ff; }
        .logs { max-height: 260px; overflow: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; font-size: .72rem; line-height: 1.4; }
        .log { border-left: 3px solid rgba(120,150,200,.4); padding: 6px 8px; margin-bottom: 6px; background: rgba(6,10,18,.8); border-radius: 8px; }
        .log.warn { border-left-color: #f5c36b; }
        .log.error { border-left-color: #ff6b6b; }
        table { width: 100%; border-collapse: collapse; font-size: .78rem; }
        th, td { padding: 6px; border-bottom: 1px solid rgba(255,255,255,.08); text-align: left; }
        th { text-transform: uppercase; letter-spacing: .1em; font-size: .65rem; opacity: .7; }
      </style>
    </head>
    <body>
      <div class="grid">
        <div class="card">
          <h1>HTOWN Server Control</h1>
          <div class="row"><span>Status</span><span id="status-pill" class="pill">-</span></div>
          <div class="row"><span>Uptime</span><span id="status-uptime">-</span></div>
          <div class="row"><span>Rooms</span><span id="status-rooms">-</span></div>
          <div class="row"><span>CCU</span><span id="status-ccu">-</span></div>
          <div class="row"><span>Memory</span><span id="status-mem">-</span></div>
          <div class="row"><span>Node</span><span id="status-node">-</span></div>
        </div>
        <div class="card">
          <h2>Admin</h2>
          <label>Admin Token</label>
          <input id="admin-token" placeholder="Enter ADMIN_TOKEN" />
          <div style="display:flex; gap:8px; margin-top:12px;">
            <button id="btn-start">Start Server</button>
            <button id="btn-stop">Stop Server</button>
          </div>
          <div style="margin-top:10px; font-size:.75rem; opacity:.7;">
            Start/Stop controls matchmaking and can disconnect active rooms.
          </div>
        </div>
        <div class="card">
          <h2>Rooms</h2>
          <table>
            <thead><tr><th>Room</th><th>Clients</th><th>Max</th><th>Mode</th></tr></thead>
            <tbody id="rooms-table"></tbody>
          </table>
        </div>
        <div class="card">
          <h2>Logs</h2>
          <div class="logs" id="log-feed"></div>
        </div>
      </div>
      <script>
        const tokenInput = document.getElementById('admin-token');
        const statusPill = document.getElementById('status-pill');
        const statusUptime = document.getElementById('status-uptime');
        const statusRooms = document.getElementById('status-rooms');
        const statusCcu = document.getElementById('status-ccu');
        const statusMem = document.getElementById('status-mem');
        const statusNode = document.getElementById('status-node');
        const roomsTable = document.getElementById('rooms-table');
        const logFeed = document.getElementById('log-feed');
        const btnStart = document.getElementById('btn-start');
        const btnStop = document.getElementById('btn-stop');
        let lastLogId = 0;

        tokenInput.value = localStorage.getItem('htownAdminToken') || '';
        tokenInput.addEventListener('input', () => {
          localStorage.setItem('htownAdminToken', tokenInput.value);
        });

        const adminFetch = (path, options = {}) => {
          const token = tokenInput.value.trim();
          const headers = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = 'Bearer ' + token;
          return fetch(path, { ...options, headers });
        };

        btnStart.addEventListener('click', async () => {
          await adminFetch('/admin/start', { method: 'POST' });
          await loadStatus();
        });

        btnStop.addEventListener('click', async () => {
          await adminFetch('/admin/stop', { method: 'POST' });
          await loadStatus();
        });

        const formatDuration = (seconds) => {
          const s = Math.floor(seconds % 60);
          const m = Math.floor((seconds / 60) % 60);
          const h = Math.floor(seconds / 3600);
          return h + 'h ' + m + 'm ' + s + 's';
        };

        const loadStatus = async () => {
          const res = await adminFetch('/admin/status');
          if (!res.ok) return;
          const data = await res.json();
          statusPill.textContent = data.acceptingPlayers ? 'ONLINE' : 'PAUSED';
          statusPill.className = 'pill ' + (data.acceptingPlayers ? 'ok' : 'off');
          statusUptime.textContent = formatDuration(data.uptime);
          statusRooms.textContent = data.roomCount;
          statusCcu.textContent = data.ccu;
          statusMem.textContent = data.memory;
          statusNode.textContent = data.node;
          roomsTable.innerHTML = data.rooms.map((room) => {
            return '<tr><td>' + room.roomId + '</td><td>' + room.clients + '</td><td>' + room.maxClients + '</td><td>' + (room.metadata?.mode || '-') + '</td></tr>';
          }).join('') || '<tr><td colspan="4">No rooms</td></tr>';
        };

        const loadLogs = async () => {
          const res = await adminFetch('/admin/logs?since=' + lastLogId);
          if (!res.ok) return;
          const data = await res.json();
          data.logs.forEach((log) => {
            lastLogId = Math.max(lastLogId, log.id);
            const div = document.createElement('div');
            div.className = 'log ' + (log.level === 'error' ? 'error' : log.level === 'warn' ? 'warn' : '');
            div.innerHTML = '<div><strong>' + log.level.toUpperCase() + '</strong> ' + log.ts + '</div><div>' + log.message + '</div>';
            logFeed.prepend(div);
          });
        };

        loadStatus();
        loadLogs();
        setInterval(loadStatus, 2000);
        setInterval(loadLogs, 1500);
      </script>
    </body>
  </html>`);
});

app.get('/admin/status', requireAdmin, async (_req, res) => {
  let rooms = [];
  try {
    rooms = await matchMaker.query({});
  } catch {
    rooms = [];
  }
  const mem = process.memoryUsage();
  res.json({
    acceptingPlayers,
    uptime: process.uptime(),
    roomCount: rooms.length,
    ccu: matchMaker.stats.local.ccu ?? 0,
    memory: `${Math.round(mem.rss / 1024 / 1024)} MB`,
    node: process.version,
    rooms
  });
});

app.get('/admin/logs', requireAdmin, (req, res) => {
  const since = Number(req.query.since ?? 0);
  res.json({ logs: logBuffer.filter((entry) => entry.id > since) });
});

app.post('/admin/start', requireAdmin, (_req, res) => {
  setAcceptingPlayers(true);
  res.json({ ok: true });
});

app.post('/admin/stop', requireAdmin, async (_req, res) => {
  setAcceptingPlayers(false);
  roomCodes.clear();
  await Promise.all(matchMaker.disconnectAll(4001));
  res.json({ ok: true });
});

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
    const me = getUserStats(payload.sub);
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

app.post('/matchmake/create', requireAuth, async (req: AuthedRequest, res) => {
  if (!acceptingPlayers) return res.status(503).json({ error: 'SERVER_PAUSED' });
  const { mode } = req.body ?? {};
  const room = await gameServer.create('game', { mode });
  const code = Math.random().toString(36).slice(2, 6).toUpperCase();
  roomCodes.set(code, room.roomId);
  return res.json({ code, roomId: room.roomId });
});

app.post('/matchmake/join', requireAuth, (req: AuthedRequest, res) => {
  if (!acceptingPlayers) return res.status(503).json({ error: 'SERVER_PAUSED' });
  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ error: 'INVALID_INPUT' });
  const roomId = roomCodes.get(code.toUpperCase());
  if (!roomId) return res.status(404).json({ error: 'ROOM_NOT_FOUND' });
  return res.json({ roomId });
});

server.listen(env.port, env.host, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://${env.host}:${env.port}`);
});
