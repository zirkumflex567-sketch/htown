import './style.css';
import Phaser from 'phaser';
import { Client } from 'colyseus.js';
import type { PlayerInput, SeatType } from '@htown/shared';

const serverUrl = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:2567';
const client = new Client(serverUrl.replace('http', 'ws'));

const state = {
  room: null as null | import('colyseus.js').Room,
  seat: 'pilot' as SeatType,
  accessToken: localStorage.getItem('accessToken') ?? '',
  refreshToken: localStorage.getItem('refreshToken') ?? '',
  playerId: '' as string,
  inputs: new Map<SeatType, PlayerInput>(),
  weapons: ['MG', 'Shotgun', 'Rocket'],
  lastError: '' as string
};

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="hud">
    <header>
      <div class="title">HTOWN CREW</div>
      <div class="status">
        <span id="seat-label">You are: PILOT</span>
        <span id="score">Score 0</span>
        <span id="wave">Wave 1</span>
        <span id="timer">00:00</span>
      </div>
    </header>
    <div class="content">
      <div class="panel left" id="pilot-panel">
        <h3>Pilot</h3>
        <div class="controls">
          <div class="stick" id="pilot-stick"></div>
          <button id="pilot-boost">Boost</button>
        </div>
      </div>
      <div class="arena" id="arena"></div>
      <div class="panel right" id="gunner-panel">
        <h3>Gunner</h3>
        <div class="controls">
          <div class="stick" id="gunner-stick"></div>
          <button id="gunner-fire">Fire</button>
          <div class="weapon-select" id="weapon-select"></div>
        </div>
      </div>
    </div>
    <div class="bottom">
      <div class="panel" id="power-panel">
        <h3>Power</h3>
        <label>Engines <input type="range" id="power-engines" min="0" max="100" value="33" /></label>
        <label>Weapons <input type="range" id="power-weapons" min="0" max="100" value="33" /></label>
        <label>Shields <input type="range" id="power-shields" min="0" max="100" value="34" /></label>
      </div>
      <div class="panel" id="support-panel">
        <h3>Support</h3>
        <button data-action="repair">Repair</button>
        <button data-action="scan">Scan</button>
        <button data-action="loot">Loot Pulse</button>
      </div>
      <div class="panel" id="systems-panel">
        <h3>Systems</h3>
        <button data-ability="0">EMP</button>
        <button data-ability="1">Shield Burst</button>
        <button data-ability="2">Slow Field</button>
      </div>
    </div>
    <div class="overlay" id="overlay">
      <div class="card">
        <h2>Login</h2>
        <input type="email" id="email" placeholder="Email" />
        <input type="password" id="password" placeholder="Password" />
        <div class="actions">
          <button id="login">Login</button>
          <button id="register">Register</button>
        </div>
        <h3>Matchmaking</h3>
        <input type="text" id="room-code" placeholder="Room Code" />
        <div class="actions">
          <button id="quick-play">Quick Play</button>
          <button id="create-room">Create Room</button>
          <button id="join-room">Join Room</button>
        </div>
        <div class="room-status" id="room-status"></div>
      </div>
    </div>
    <button class="debug-fab" id="debug-fab" title="Toggle debug (\` or Ctrl+D)">Debug</button>
    <div class="debug-console hidden" id="debug-console">
      <div class="debug-header">
        <div>
          <div class="debug-title">Debug Console</div>
          <div class="debug-hint">Press \` or Ctrl+D to toggle</div>
        </div>
        <div class="debug-actions">
          <button id="debug-copy">Copy</button>
          <button id="debug-clear">Clear</button>
          <button id="debug-close">Close</button>
        </div>
      </div>
      <div class="debug-body">
        <div class="debug-meta">
          <div class="debug-section">
            <h4>Session</h4>
            <div class="debug-kv"><span>Server</span><span id="debug-server"></span></div>
            <div class="debug-kv"><span>WS</span><span id="debug-ws"></span></div>
            <div class="debug-kv"><span>Room</span><span id="debug-room"></span></div>
            <div class="debug-kv"><span>Seat</span><span id="debug-seat"></span></div>
          </div>
          <div class="debug-section">
            <h4>Auth</h4>
            <div class="debug-kv"><span>User</span><span id="debug-user"></span></div>
            <div class="debug-kv"><span>Access</span><span id="debug-access"></span></div>
            <div class="debug-kv"><span>Refresh</span><span id="debug-refresh"></span></div>
            <div class="debug-kv"><span>Last error</span><span id="debug-error"></span></div>
          </div>
        </div>
        <div class="debug-logs" id="debug-logs"></div>
      </div>
    </div>
    <div class="swap-banner" id="swap-banner"></div>
    <div class="upgrade" id="upgrade"></div>
  </div>
`;

const overlay = document.getElementById('overlay')!;
const swapBanner = document.getElementById('swap-banner')!;
const upgrade = document.getElementById('upgrade')!;
const seatLabel = document.getElementById('seat-label')!;
const roomStatus = document.getElementById('room-status')!;
const debugConsole = document.getElementById('debug-console')!;
const debugFab = document.getElementById('debug-fab')! as HTMLButtonElement;
const debugClose = document.getElementById('debug-close')!;
const debugCopy = document.getElementById('debug-copy')!;
const debugClear = document.getElementById('debug-clear')!;
const debugLogs = document.getElementById('debug-logs')!;
const debugServer = document.getElementById('debug-server')!;
const debugWs = document.getElementById('debug-ws')!;
const debugRoom = document.getElementById('debug-room')!;
const debugSeat = document.getElementById('debug-seat')!;
const debugUser = document.getElementById('debug-user')!;
const debugAccess = document.getElementById('debug-access')!;
const debugRefresh = document.getElementById('debug-refresh')!;
const debugError = document.getElementById('debug-error')!;

type LogLevel = 'info' | 'warn' | 'error';
const debugState = {
  open: false,
  logs: [] as Array<{ ts: string; level: LogLevel; message: string; data?: unknown }>
};

function updateDebugMeta() {
  debugServer.textContent = serverUrl;
  debugWs.textContent = serverUrl.replace('http', 'ws');
  debugRoom.textContent = state.room?.id ?? '—';
  debugSeat.textContent = state.seat;
  debugUser.textContent = state.playerId || '—';
  debugAccess.textContent = state.accessToken ? 'set' : 'missing';
  debugRefresh.textContent = state.refreshToken ? 'set' : 'missing';
  debugError.textContent = state.lastError || '—';
}

function formatLogData(data: unknown) {
  if (data === undefined) return '';
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function renderLogs() {
  debugLogs.innerHTML = '';
  debugState.logs.forEach((entry) => {
    const row = document.createElement('div');
    row.className = `debug-log ${entry.level}`;
    const header = document.createElement('div');
    header.className = 'debug-log-header';
    const ts = document.createElement('span');
    ts.className = 'debug-log-ts';
    ts.textContent = entry.ts;
    const msg = document.createElement('span');
    msg.className = 'debug-log-msg';
    msg.textContent = entry.message;
    header.append(ts, msg);
    row.append(header);
    if (entry.data !== undefined) {
      const pre = document.createElement('pre');
      pre.textContent = formatLogData(entry.data);
      row.append(pre);
    }
    debugLogs.append(row);
  });
  debugLogs.scrollTop = debugLogs.scrollHeight;
}

function addLog(level: LogLevel, message: string, data?: unknown) {
  const entry = {
    ts: new Date().toLocaleTimeString(),
    level,
    message,
    data
  };
  debugState.logs.push(entry);
  if (debugState.logs.length > 200) {
    debugState.logs.shift();
  }
  if (level === 'error') {
    state.lastError = message;
  }
  updateDebugMeta();
  renderLogs();
}

function toggleDebug(force?: boolean) {
  debugState.open = force ?? !debugState.open;
  debugConsole.classList.toggle('hidden', !debugState.open);
}

function getSafeHeaders(headers: HeadersInit | undefined) {
  if (!headers) return undefined;
  const entries =
    headers instanceof Headers ? Array.from(headers.entries()) : Array.isArray(headers) ? headers : Object.entries(headers);
  return Object.fromEntries(
    entries.map(([key, value]) => [key, key.toLowerCase() === 'authorization' ? 'Bearer ***' : String(value)])
  );
}

function createDebugSnapshot() {
  return JSON.stringify(
    {
      time: new Date().toISOString(),
      serverUrl,
      wsUrl: serverUrl.replace('http', 'ws'),
      seat: state.seat,
      playerId: state.playerId || null,
      roomId: state.room?.id ?? null,
      accessToken: state.accessToken ? '[set]' : null,
      refreshToken: state.refreshToken ? '[set]' : null,
      lastError: state.lastError || null,
      logs: debugState.logs.slice(-50)
    },
    null,
    2
  );
}

debugFab.addEventListener('click', () => toggleDebug());
debugClose.addEventListener('click', () => toggleDebug(false));
debugClear.addEventListener('click', () => {
  debugState.logs = [];
  renderLogs();
});
debugCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(createDebugSnapshot());
    addLog('info', 'Copied debug snapshot to clipboard.');
  } catch (error) {
    addLog('error', 'Failed to copy debug snapshot.', error);
  }
});

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
  if (event.key === '`' || (event.ctrlKey && event.key.toLowerCase() === 'd')) {
    event.preventDefault();
    toggleDebug();
  }
});

window.addEventListener('error', (event) => {
  addLog('error', 'Window error', {
    message: event.message,
    source: event.filename,
    line: event.lineno,
    column: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  addLog('error', 'Unhandled rejection', event.reason);
});

const weaponSelect = document.getElementById('weapon-select')!;
state.weapons.forEach((name, idx) => {
  const button = document.createElement('button');
  button.textContent = name;
  button.addEventListener('click', () => {
    sendInput({ seat: 'gunner', weaponIndex: idx });
  });
  weaponSelect.appendChild(button);
});

function setSeat(seat: SeatType) {
  state.seat = seat;
  seatLabel.textContent = `You are: ${seat.toUpperCase()}`;
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
  const panel = document.getElementById(`${seat}-panel`);
  panel?.classList.add('active');
  updateDebugMeta();
}

function sendInput(input: PlayerInput) {
  if (!state.room) return;
  state.room.send('input', input);
}

const pilotBoost = document.getElementById('pilot-boost')! as HTMLButtonElement;
const pilotStick = document.getElementById('pilot-stick')!;
const gunnerStick = document.getElementById('gunner-stick')!;
const gunnerFire = document.getElementById('gunner-fire')! as HTMLButtonElement;

let pilotAxis = { x: 0, y: 0 };
let gunnerAxis = { x: 1, y: 0 };

setupStick(pilotStick, (vec) => {
  pilotAxis = vec;
  sendInput({ seat: 'pilot', move: pilotAxis, boost: pilotBoost.dataset.active === 'true' });
});

setupStick(gunnerStick, (vec) => {
  gunnerAxis = vec;
  sendInput({ seat: 'gunner', aim: gunnerAxis, fire: gunnerFire.dataset.active === 'true' });
});

pilotBoost.addEventListener('click', () => {
  pilotBoost.dataset.active = pilotBoost.dataset.active === 'true' ? 'false' : 'true';
  sendInput({ seat: 'pilot', move: pilotAxis, boost: pilotBoost.dataset.active === 'true' });
});

gunnerFire.addEventListener('click', () => {
  gunnerFire.dataset.active = gunnerFire.dataset.active === 'true' ? 'false' : 'true';
  sendInput({ seat: 'gunner', aim: gunnerAxis, fire: gunnerFire.dataset.active === 'true' });
});

const powerEngines = document.getElementById('power-engines')! as HTMLInputElement;
const powerWeapons = document.getElementById('power-weapons')! as HTMLInputElement;
const powerShields = document.getElementById('power-shields')! as HTMLInputElement;

[powerEngines, powerWeapons, powerShields].forEach((slider) => {
  slider.addEventListener('input', () => {
    const total = Number(powerEngines.value) + Number(powerWeapons.value) + Number(powerShields.value);
    const norm = (value: number) => (total === 0 ? 0.33 : value / total);
    sendInput({
      seat: 'power',
      power: {
        engines: norm(Number(powerEngines.value)),
        weapons: norm(Number(powerWeapons.value)),
        shields: norm(Number(powerShields.value))
      }
    });
  });
});

document.querySelectorAll('#systems-panel button').forEach((button) => {
  button.addEventListener('click', () => {
    const abilityIndex = Number(button.getAttribute('data-ability'));
    sendInput({ seat: 'systems', systems: { abilityIndex } });
  });
});

document.querySelectorAll('#support-panel button').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.getAttribute('data-action') as 'repair' | 'scan' | 'loot';
    sendInput({ seat: 'support', support: { action } });
  });
});

async function requestJson(
  endpoint: string,
  options: RequestInit,
  label: string,
  logOptions?: { redactBody?: boolean }
) {
  const url = `${serverUrl}${endpoint}`;
  const started = performance.now();
  const safeOptions = {
    method: options.method ?? 'GET',
    headers: getSafeHeaders(options.headers),
    body: logOptions?.redactBody ? '[redacted]' : options.body
  };
  addLog('info', `→ ${label}`, { url, options: safeOptions });
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    addLog('error', `✖ ${label} network error`, error);
    throw error;
  }
  const text = await response.text();
  let data: any = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  const elapsed = Math.round(performance.now() - started);
  addLog(response.ok ? 'info' : 'error', `← ${label} ${response.status} ${response.statusText} (${elapsed}ms)`, data);
  return { response, data };
}

async function auth(endpoint: string, payload: Record<string, string>) {
  const { response, data } = await requestJson(
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    endpoint === '/auth/login' ? 'login' : 'register',
    { redactBody: true }
  );
  if (!response.ok) {
    throw new Error(data?.error || 'Auth failed');
  }
  state.accessToken = data.accessToken;
  state.refreshToken = data.refreshToken;
  localStorage.setItem('accessToken', state.accessToken);
  localStorage.setItem('refreshToken', state.refreshToken);
  updateDebugMeta();
}

async function connect(roomId?: string) {
  if (!state.accessToken) {
    addLog('warn', 'Connect blocked: missing access token.');
    return;
  }
  state.playerId = getTokenPayload(state.accessToken) ?? '';
  updateDebugMeta();
  const options = { userId: state.playerId };
  addLog('info', 'Connecting to room', { roomId: roomId ?? 'matchmake', userId: state.playerId });
  try {
    state.room = roomId ? await client.joinById(roomId, options) : await client.joinOrCreate('game', options);
  } catch (error) {
    addLog('error', 'Room connect failed', error);
    throw error;
  }
  overlay.classList.add('hidden');
  updateDebugMeta();
  state.room.onError((code, message) => {
    addLog('error', 'Room error', { code, message });
  });
  state.room.onLeave((code) => {
    addLog('warn', 'Room left', { code });
  });
  state.room.onMessage('gameover', (payload) => {
    upgrade.innerHTML = `<strong>Run ended</strong><span>Score ${payload.score}</span>`;
    upgrade.classList.add('show');
    setTimeout(() => upgrade.classList.remove('show'), 4000);
  });
  state.room.state.players.onAdd = (player, key) => {
    if (key === state.playerId) {
      setSeat(player.seat);
    }
  };
  state.room.state.players.onChange = (player, key) => {
    if (key === state.playerId) {
      setSeat(player.seat);
    }
  };
  state.room.state.listen('swapCountdown', (value) => {
    if (value > 0) {
      swapBanner.textContent = `Swap in ${value}`;
      swapBanner.classList.add('show');
    } else {
      swapBanner.classList.remove('show');
    }
  });
  state.room.state.listen('swapLabel', (value) => {
    if (value) {
      swapBanner.textContent = value;
      swapBanner.classList.add('show');
    }
  });
  state.room.state.listen('score', (value) => {
    document.getElementById('score')!.textContent = `Score ${value}`;
  });
  state.room.state.listen('wave', (value) => {
    document.getElementById('wave')!.textContent = `Wave ${value}`;
  });
  state.room.state.listen('timeSurvived', (value) => {
    const minutes = Math.floor(value / 60).toString().padStart(2, '0');
    const seconds = Math.floor(value % 60).toString().padStart(2, '0');
    document.getElementById('timer')!.textContent = `${minutes}:${seconds}`;
  });
  state.room.state.upgradeChoices.onAdd = () => {
    if (state.room?.state.upgradeChoices.length) {
      upgrade.innerHTML = state.room.state.upgradeChoices
        .map((choice) => `<button data-upgrade="${choice.id}">${choice.name}<span>${choice.description}</span></button>`)
        .join('');
      upgrade.classList.add('show');
      upgrade.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => {
          const id = button.getAttribute('data-upgrade');
          if (id) state.room?.send('upgrade', id);
          upgrade.classList.remove('show');
        });
      });
    }
  };
}

function getTokenPayload(token: string) {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(atob(payload));
    return decoded.sub;
  } catch {
    return undefined;
  }
}

const loginButton = document.getElementById('login')!;
const registerButton = document.getElementById('register')!;
const quickPlayButton = document.getElementById('quick-play')!;
const createRoomButton = document.getElementById('create-room')!;
const joinRoomButton = document.getElementById('join-room')!;

loginButton.addEventListener('click', async () => {
  const email = (document.getElementById('email') as HTMLInputElement).value;
  const password = (document.getElementById('password') as HTMLInputElement).value;
  roomStatus.textContent = '';
  try {
    await auth('/auth/login', { email, password });
    await connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed.';
    roomStatus.textContent = message;
    addLog('error', 'Login failed', { message });
  }
});

registerButton.addEventListener('click', async () => {
  const email = (document.getElementById('email') as HTMLInputElement).value;
  const password = (document.getElementById('password') as HTMLInputElement).value;
  roomStatus.textContent = '';
  try {
    await auth('/auth/register', { email, password });
    await connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Register failed.';
    roomStatus.textContent = message;
    addLog('error', 'Register failed', { message });
  }
});

if (state.accessToken) {
  connect();
}

quickPlayButton.addEventListener('click', async () => {
  roomStatus.textContent = '';
  try {
    await connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Quick Play failed.';
    roomStatus.textContent = message;
    addLog('error', 'Quick Play failed', { message });
  }
});

createRoomButton.addEventListener('click', async () => {
  if (!state.accessToken) return;
  roomStatus.textContent = '';
  const { response, data } = await requestJson(
    '/matchmake/create',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.accessToken}` }
    },
    'create room'
  );
  if (!response.ok) {
    roomStatus.textContent = data?.error || 'Could not create room.';
    return;
  }
  roomStatus.textContent = `Room code: ${data.code}`;
  await connect(data.roomId);
});

joinRoomButton.addEventListener('click', async () => {
  if (!state.accessToken) return;
  const code = (document.getElementById('room-code') as HTMLInputElement).value;
  roomStatus.textContent = '';
  const { response, data } = await requestJson(
    '/matchmake/join',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    },
    'join room'
  );
  if (!response.ok) {
    roomStatus.textContent = data?.error || 'Could not join room.';
    return;
  }
  await connect(data.roomId);
});

updateDebugMeta();
addLog('info', 'Debug console ready.');

class GameScene extends Phaser.Scene {
  private ship?: Phaser.GameObjects.Arc;
  private enemies: Phaser.GameObjects.Arc[] = [];
  private lightMask?: Phaser.GameObjects.Graphics;

  constructor() {
    super('game');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b0f1a');
    this.ship = this.add.circle(0, 0, 10, 0x4fd1ff);
  }

  update() {
    if (!state.room) return;
    const shipState = state.room.state.ship;
    if (!shipState) return;
    this.ship?.setPosition(shipState.position.x, shipState.position.y);

    this.enemies.forEach((enemy) => enemy.destroy());
    this.enemies = [];

    state.room.state.enemies.forEach((enemy) => {
      const sprite = this.add.circle(enemy.position.x, enemy.position.y, 8, 0xff4f4f);
      this.enemies.push(sprite);
    });

    if (!this.lightMask) {
      this.lightMask = this.add.graphics();
      this.lightMask.fillStyle(0x000000, 0.82);
    }
    const { width, height } = this.scale;
    this.lightMask.clear();
    this.lightMask.fillStyle(0x000000, 0.82);
    this.lightMask.fillRect(-width, -height, width * 2, height * 2);
    this.lightMask.fillStyle(0x000000, 0);
    this.lightMask.fillCircle(shipState.position.x, shipState.position.y, shipState.visionRadius);
    this.lightMask.setBlendMode(Phaser.BlendModes.MULTIPLY);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'arena',
  width: 720,
  height: 480,
  backgroundColor: '#0b0f1a',
  scene: [GameScene],
  physics: {
    default: 'arcade'
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});

function setupStick(element: HTMLElement, onChange: (vec: { x: number; y: number }) => void) {
  let dragging = false;
  const center = { x: 0, y: 0 };

  element.addEventListener('pointerdown', (event) => {
    dragging = true;
    const rect = element.getBoundingClientRect();
    center.x = rect.left + rect.width / 2;
    center.y = rect.top + rect.height / 2;
    update(event);
  });

  element.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    update(event);
  });

  element.addEventListener('pointerup', () => {
    dragging = false;
    onChange({ x: 0, y: 0 });
  });

  element.addEventListener('pointerleave', () => {
    if (dragging) {
      dragging = false;
      onChange({ x: 0, y: 0 });
    }
  });

  function update(event: PointerEvent) {
    const dx = event.clientX - center.x;
    const dy = event.clientY - center.y;
    const len = Math.hypot(dx, dy) || 1;
    const radius = 40;
    const clamp = Math.min(len, radius) / radius;
    onChange({ x: (dx / len) * clamp, y: (dy / len) * clamp });
  }
}
