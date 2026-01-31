import Phaser from 'phaser';
import { Client as ColyseusClient, Room } from 'colyseus.js';
import type { RoomSnapshot, SeatType } from '@htown/shared';
import './style.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:2567';

const authPanel = document.getElementById('auth-panel') as HTMLDivElement;
const emailInput = document.getElementById('auth-email') as HTMLInputElement;
const passwordInput = document.getElementById('auth-password') as HTMLInputElement;
const loginButton = document.getElementById('auth-login') as HTMLButtonElement;
const registerButton = document.getElementById('auth-register') as HTMLButtonElement;
const quickPlayButton = document.getElementById('auth-quickplay') as HTMLButtonElement;
const authStatus = document.getElementById('auth-status') as HTMLDivElement;
const roomCodeInput = document.getElementById('room-code') as HTMLInputElement;

const statusLine = document.getElementById('status') as HTMLDivElement;
const roleName = document.getElementById('role-name') as HTMLSpanElement;
const swapWarning = document.getElementById('swap-warning') as HTMLDivElement;
const swapCountdown = document.getElementById('swap-countdown') as HTMLSpanElement;
const upgradePanel = document.getElementById('upgrade-panel') as HTMLDivElement;
const upgradeOptions = document.getElementById('upgrade-options') as HTMLDivElement;

const seatControls = {
  pilot: {
    boost: document.getElementById('pilot-boost') as HTMLButtonElement,
  },
  gunner: {
    fire: document.getElementById('gunner-fire') as HTMLButtonElement,
    weapon: document.getElementById('gunner-weapon') as HTMLButtonElement,
  },
  power: {
    engines: document.getElementById('power-engines') as HTMLInputElement,
    weapons: document.getElementById('power-weapons') as HTMLInputElement,
    shields: document.getElementById('power-shields') as HTMLInputElement,
  },
  systems: {
    overdrive: document.getElementById('systems-overdrive') as HTMLButtonElement,
  },
  support: {
    repair: document.getElementById('support-repair') as HTMLButtonElement,
    ping: document.getElementById('support-ping') as HTMLButtonElement,
    loot: document.getElementById('support-loot') as HTMLButtonElement,
  },
};

let accessToken = localStorage.getItem('accessToken');
let refreshToken = localStorage.getItem('refreshToken');

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

async function handleAuth(action: 'login' | 'register') {
  authStatus.textContent = '...';
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  try {
    const data = await request(`/auth/${action}`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
    localStorage.setItem('accessToken', accessToken ?? '');
    localStorage.setItem('refreshToken', refreshToken ?? '');
    authPanel.classList.add('hidden');
    await connectRoom();
  } catch (error) {
    authStatus.textContent = 'Auth failed';
  }
}

loginButton.addEventListener('click', () => handleAuth('login'));
registerButton.addEventListener('click', () => handleAuth('register'));
quickPlayButton.addEventListener('click', async () => {
  if (!accessToken) {
    authStatus.textContent = 'Login required for quick play';
    return;
  }
  authPanel.classList.add('hidden');
  await connectRoom();
});

class GameScene extends Phaser.Scene {
  ship?: Phaser.GameObjects.Arc;
  enemies = new Map<string, Phaser.GameObjects.Arc>();
  projectiles = new Map<string, Phaser.GameObjects.Rectangle>();
  darkness?: Phaser.GameObjects.Graphics;

  constructor() {
    super('game');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0f14');
    this.ship = this.add.circle(0, 0, 16, 0x4da3ff);
    this.darkness = this.add.graphics();
  }

  updateSnapshot(snapshot: RoomSnapshot) {
    if (this.ship) {
      this.ship.setPosition(snapshot.ship.x, snapshot.ship.y);
    }
    this.cameras.main.centerOn(snapshot.ship.x, snapshot.ship.y);
    this.syncEnemies(snapshot);
    this.syncProjectiles(snapshot);
    this.renderDarkness(snapshot);
  }

  private syncEnemies(snapshot: RoomSnapshot) {
    const ids = new Set(snapshot.enemies.map((enemy) => enemy.id));
    for (const [id, sprite] of this.enemies.entries()) {
      if (!ids.has(id)) {
        sprite.destroy();
        this.enemies.delete(id);
      }
    }
    snapshot.enemies.forEach((enemy) => {
      let sprite = this.enemies.get(enemy.id);
      if (!sprite) {
        sprite = this.add.circle(0, 0, 12, 0xf05454);
        this.enemies.set(enemy.id, sprite);
      }
      sprite.setPosition(enemy.x, enemy.y);
    });
  }

  private syncProjectiles(snapshot: RoomSnapshot) {
    const ids = new Set(snapshot.projectiles.map((proj) => proj.id));
    for (const [id, sprite] of this.projectiles.entries()) {
      if (!ids.has(id)) {
        sprite.destroy();
        this.projectiles.delete(id);
      }
    }
    snapshot.projectiles.forEach((proj) => {
      let sprite = this.projectiles.get(proj.id);
      if (!sprite) {
        sprite = this.add.rectangle(0, 0, 6, 2, 0xffffff);
        this.projectiles.set(proj.id, sprite);
      }
      sprite.setPosition(proj.x, proj.y);
    });
  }

  private renderDarkness(snapshot: RoomSnapshot) {
    if (!this.darkness) {
      return;
    }
    this.darkness.clear();
    const camera = this.cameras.main;
    this.darkness.fillStyle(0x05070a, 0.82);
    this.darkness.fillRect(
      camera.worldView.x,
      camera.worldView.y,
      camera.worldView.width,
      camera.worldView.height,
    );
    this.darkness.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.darkness.beginPath();
    this.darkness.fillStyle(0x000000, 0);
    this.darkness.arc(snapshot.ship.x, snapshot.ship.y, 160, 0, Math.PI * 2);
    this.darkness.fillPath();
  }
}

const scene = new GameScene();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: window.innerWidth,
  height: window.innerHeight,
  scene,
  backgroundColor: '#0a0f14',
});

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});

let room: Room | undefined;
let currentSeat: SeatType | 'spectator' = 'spectator';
let runSubmitted = false;
const inputState = {
  axisX: 0,
  axisY: 0,
  boost: false,
  fire: false,
  aimX: 1,
  aimY: 0,
  weapon: 0,
  powerDistribution: { engines: 34, weapons: 33, shields: 33 },
  abilities: { overdrive: false },
  support: { repair: false, ping: false, lootPulse: false },
};

async function connectRoom() {
  const client = new ColyseusClient(API_URL.replace('http', 'ws'));
  const roomCode = roomCodeInput.value.trim();
  if (roomCode) {
    const rooms = await request('/matchmaking/rooms');
    const match = rooms.find((entry: { roomCode: string }) => entry.roomCode === roomCode);
    if (!match) {
      authStatus.textContent = 'Room not found';
      authPanel.classList.remove('hidden');
      return;
    }
    room = await client.joinById(match.roomId, { token: accessToken ?? '', email: emailInput.value });
  } else {
    room = await client.joinOrCreate('game', { token: accessToken ?? '', email: emailInput.value });
  }
  room.onMessage('snapshot', (snapshot: RoomSnapshot) => {
    scene.updateSnapshot(snapshot);
    statusLine.textContent = `Wave ${snapshot.wave} · Score ${snapshot.score} · Time ${snapshot.time.toFixed(1)}`;
    const mySeat = snapshot.seatAssignments[room?.sessionId ?? ''];
    if (mySeat && mySeat !== currentSeat) {
      currentSeat = mySeat;
      roleName.textContent = mySeat.toUpperCase();
      updateSeatInteractivity();
    }
    if (snapshot.swap.inCountdown) {
      swapWarning.classList.remove('hidden');
      swapCountdown.textContent = snapshot.swap.timeRemaining.toFixed(0);
    } else {
      swapWarning.classList.add('hidden');
    }
    if (!runSubmitted && snapshot.ship.hp <= 0) {
      runSubmitted = true;
      request('/runs/submit', {\n        method: 'POST',\n        body: JSON.stringify({ score: snapshot.score, summary: { wave: snapshot.wave } }),\n      }).catch(() => undefined);
    }
  });

  room.onMessage('upgrade:options', (options: Array<{ id: string; name: string }>) => {
    upgradePanel.classList.remove('hidden');
    upgradeOptions.innerHTML = '';
    options.forEach((option) => {
      const button = document.createElement('button');
      button.textContent = option.name;
      button.addEventListener('click', () => {
        room?.send('upgrade:apply', option.id);
        upgradePanel.classList.add('hidden');
      });
      upgradeOptions.appendChild(button);
    });
  });

  room.onMessage('swap:warning', () => {
    swapWarning.classList.remove('hidden');
  });

  setInterval(() => {
    if (!room) {
      return;
    }
    if (currentSeat === 'pilot') {
      room.send('input', { axisX: inputState.axisX, axisY: inputState.axisY, boost: inputState.boost });
    } else if (currentSeat === 'gunner') {
      room.send('input', { fire: inputState.fire, aim: { x: inputState.aimX, y: inputState.aimY }, weaponIndex: inputState.weapon });
    } else if (currentSeat === 'power') {
      room.send('input', {
        powerDistribution: {
          engines: inputState.powerDistribution.engines / 100,
          weapons: inputState.powerDistribution.weapons / 100,
          shields: inputState.powerDistribution.shields / 100,
        },
      });
    } else if (currentSeat === 'systems') {
      room.send('input', { abilities: { overdrive: inputState.abilities.overdrive } });
    } else if (currentSeat === 'support') {
      room.send('input', {
        support: {
          repair: inputState.support.repair,
          ping: inputState.support.ping,
          lootPulse: inputState.support.lootPulse,
        },
      });
    }
  }, 50);

  setInterval(() => {
    room?.send('upgrade:roll');
  }, 25000);

  room.onMessage('swap:complete', () => {
    swapWarning.classList.add('hidden');
  });
}

function updateSeatInteractivity() {
  const enable = (element: HTMLElement, active: boolean) => {
    element.classList.toggle('active', active);
    if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
      element.disabled = !active;
    }
  };
  enable(seatControls.pilot.boost, currentSeat === 'pilot');
  enable(seatControls.gunner.fire, currentSeat === 'gunner');
  enable(seatControls.gunner.weapon, currentSeat === 'gunner');
  enable(seatControls.power.engines, currentSeat === 'power');
  enable(seatControls.power.weapons, currentSeat === 'power');
  enable(seatControls.power.shields, currentSeat === 'power');
  enable(seatControls.systems.overdrive, currentSeat === 'systems');
  enable(seatControls.support.repair, currentSeat === 'support');
  enable(seatControls.support.ping, currentSeat === 'support');
  enable(seatControls.support.loot, currentSeat === 'support');
}

window.addEventListener('keydown', (event) => {
  if (currentSeat === 'pilot') {
    if (event.key === 'w') inputState.axisY = -1;
    if (event.key === 's') inputState.axisY = 1;
    if (event.key === 'a') inputState.axisX = -1;
    if (event.key === 'd') inputState.axisX = 1;
    if (event.key === ' ') inputState.boost = true;
  }
  if (currentSeat === 'gunner' && event.key === ' ') {
    inputState.fire = true;
  }
});

window.addEventListener('keyup', (event) => {
  if (currentSeat === 'pilot') {
    if (event.key === 'w' || event.key === 's') inputState.axisY = 0;
    if (event.key === 'a' || event.key === 'd') inputState.axisX = 0;
    if (event.key === ' ') inputState.boost = false;
  }
  if (currentSeat === 'gunner' && event.key === ' ') {
    inputState.fire = false;
  }
});

window.addEventListener('pointermove', (event) => {
  if (currentSeat !== 'gunner') {
    return;
  }
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  inputState.aimX = event.clientX - centerX;
  inputState.aimY = event.clientY - centerY;
});

seatControls.pilot.boost.addEventListener('pointerdown', () => {
  inputState.boost = true;
});
seatControls.pilot.boost.addEventListener('pointerup', () => {
  inputState.boost = false;
});
seatControls.gunner.fire.addEventListener('pointerdown', () => {
  inputState.fire = true;
});
seatControls.gunner.fire.addEventListener('pointerup', () => {
  inputState.fire = false;
});
seatControls.gunner.weapon.addEventListener('click', () => {
  inputState.weapon = (inputState.weapon + 1) % 3;
});
seatControls.power.engines.addEventListener('input', (event) => {
  inputState.powerDistribution.engines = Number((event.target as HTMLInputElement).value);
});
seatControls.power.weapons.addEventListener('input', (event) => {
  inputState.powerDistribution.weapons = Number((event.target as HTMLInputElement).value);
});
seatControls.power.shields.addEventListener('input', (event) => {
  inputState.powerDistribution.shields = Number((event.target as HTMLInputElement).value);
});
seatControls.systems.overdrive.addEventListener('pointerdown', () => {
  inputState.abilities.overdrive = true;
});
seatControls.systems.overdrive.addEventListener('pointerup', () => {
  inputState.abilities.overdrive = false;
});
seatControls.support.repair.addEventListener('pointerdown', () => {
  inputState.support.repair = true;
});
seatControls.support.repair.addEventListener('pointerup', () => {
  inputState.support.repair = false;
});
seatControls.support.ping.addEventListener('pointerdown', () => {
  inputState.support.ping = true;
});
seatControls.support.ping.addEventListener('pointerup', () => {
  inputState.support.ping = false;
});
seatControls.support.loot.addEventListener('pointerdown', () => {
  inputState.support.lootPulse = true;
});
seatControls.support.loot.addEventListener('pointerup', () => {
  inputState.support.lootPulse = false;
});

if (accessToken) {
  authPanel.classList.add('hidden');
  connectRoom().catch(() => {
    authPanel.classList.remove('hidden');
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
