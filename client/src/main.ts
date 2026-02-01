import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Client } from 'colyseus.js';
import { caveBaseRadius, cavePath, mulberry32, weapons as weaponDefs } from '@htown/shared';
import type { GameMode, PlayerInput, SeatType } from '@htown/shared';

const defaultServerHost = window.location.hostname || 'localhost';
const urlParams = new URLSearchParams(window.location.search);
const e2eMode = urlParams.has('e2e');
const e2eScene = e2eMode ? urlParams.get('e2eScene') : null;
const e2eStaticScene =
  e2eScene === 'projectiles' || e2eScene === 'wave' || e2eScene === 'telegraph' || e2eScene === 'summary';
const e2eVisualsEnabled = e2eStaticScene || e2eScene === 'cave';
const e2eRadarActive = e2eScene === 'telegraph';
const e2eSeatParam = e2eMode ? urlParams.get('e2eSeat') : null;
const e2eSeat = e2eSeatParam && ['pilot', 'gunner', 'power', 'systems', 'support'].includes(e2eSeatParam)
  ? (e2eSeatParam as SeatType)
  : null;
const serverUrl = import.meta.env.VITE_SERVER_URL ?? `http://${defaultServerHost}:2567`;
const adminUrl = import.meta.env.VITE_ADMIN_URL ?? `${window.location.origin}/admin`;
const client = new Client(serverUrl.replace('http', 'ws'));

const state = {
  room: null as null | import('colyseus.js').Room,
  seat: 'pilot' as SeatType,
  mode: 'crew' as GameMode,
  userEmail: localStorage.getItem('userEmail') ?? '',
  accessToken: localStorage.getItem('accessToken') ?? '',
  refreshToken: localStorage.getItem('refreshToken') ?? '',
  playerId: '' as string,
  inputs: new Map<SeatType, PlayerInput>(),
  weapons: weaponDefs.map((weapon) => weapon.name),
  lastError: '' as string
};

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="hud">
    <div class="content">
      <div class="arena" id="arena">
        <div class="arena-ui">
          <div class="seat-indicator" id="seat-indicator">PILOT SEAT</div>
          <header>
            <div class="title">HTOWN CREW</div>
            <div class="status">
              <span id="seat-label">You are: PILOT</span>
              <span id="score">Score 0</span>
              <span id="wave">Wave 1</span>
              <span id="timer">00:00</span>
              <span id="input-state">Input 0,0</span>
              <span id="key-state">Key -</span>
              <span id="build-label">Build spacekit2023</span>
            </div>
          </header>
          <div class="combo-toast" id="combo-toast"></div>
          <div class="seat-layout">
            <div class="seat-focus" id="seat-focus">
              <div class="panel seat-panel pilot" id="pilot-panel">
                <h3>Pilot <span class="panel-seat" id="pilot-seat"></span></h3>
                <div class="panel-meta" id="pilot-meta"></div>
                <div class="controls">
                  <div class="stick" id="pilot-stick"></div>
                  <button id="pilot-boost">Boost</button>
                  <button id="pilot-aim" data-active="false">Aim Move</button>
                </div>
              </div>
              <div class="panel seat-panel gunner" id="gunner-panel">
                <h3>Gunner <span class="panel-seat" id="gunner-seat"></span></h3>
                <div class="panel-meta" id="gunner-meta"></div>
                <div class="controls">
                  <div class="stick" id="gunner-stick"></div>
                  <button id="gunner-fire">Fire</button>
                  <div class="weapon-select" id="weapon-select"></div>
                </div>
              </div>
              <div class="panel seat-panel power" id="power-panel">
                <h3>Power <span class="panel-seat" id="power-seat"></span></h3>
                <div class="panel-meta" id="power-meta"></div>
                <div class="power-bars">
                  <div class="power-bar"><span>ENG</span><div class="bar"><div class="fill" id="power-bar-eng"></div></div></div>
                  <div class="power-bar"><span>WPN</span><div class="bar"><div class="fill" id="power-bar-wep"></div></div></div>
                  <div class="power-bar"><span>SHD</span><div class="bar"><div class="fill" id="power-bar-shd"></div></div></div>
                </div>
                <div class="power-status">
                  <div class="status-row"><span>Instability</span><div class="meter"><div id="power-instability"></div></div></div>
                  <div class="status-row"><span>Heat</span><div class="meter"><div id="power-heat"></div></div></div>
                  <div class="status-row"><span>Timing</span><div class="meter timing"><div id="power-window"></div></div></div>
                </div>
                <label>Engines <input type="range" id="power-engines" min="0" max="100" value="33" /></label>
                <label>Weapons <input type="range" id="power-weapons" min="0" max="100" value="33" /></label>
                <label>Shields <input type="range" id="power-shields" min="0" max="100" value="34" /></label>
                <div class="preset-row">
                  <button data-preset="attack">Attack</button>
                  <button data-preset="defense">Defense</button>
                  <button data-preset="speed">Speed</button>
                  <button data-preset="balanced">Balanced</button>
                </div>
              </div>
              <div class="panel seat-panel support" id="support-panel">
                <h3>Support <span class="panel-seat" id="support-seat"></span></h3>
                <div class="panel-meta" id="support-meta"></div>
                <div class="support-status">
                  <div class="support-radar">
                    <span>Radar</span>
                    <div class="meter"><div id="support-radar"></div></div>
                  </div>
                  <div class="support-repair">
                    <span>Repair Window</span>
                    <div class="meter timing"><div id="support-repair-window"></div></div>
                  </div>
                </div>
                <div class="support-actions">
                  <button data-action="repair">Repair</button>
                  <button data-action="scan">Scan</button>
                  <button data-action="loot">Loot Pulse</button>
                </div>
              </div>
              <div class="panel seat-panel systems" id="systems-panel">
                <h3>Systems <span class="panel-seat" id="systems-seat"></span></h3>
                <div class="panel-meta" id="systems-meta"></div>
                <div class="systems-modes" id="systems-modes"></div>
                <div class="systems-actions">
                  <button data-ability="0">EMP</button>
                  <button data-ability="1">Shield Burst</button>
                  <button data-ability="2">Slow Field</button>
                  <button data-ability="3">Overdrive</button>
                </div>
              </div>
            </div>
            <div class="crew-overview" id="crew-overview">
              <div class="crew-tile" id="crew-pilot"><span class="crew-seat">Pilot</span><span class="crew-tag" id="crew-pilot-tag"></span><div class="crew-meta" id="crew-pilot-meta"></div></div>
              <div class="crew-tile" id="crew-gunner"><span class="crew-seat">Gunner</span><span class="crew-tag" id="crew-gunner-tag"></span><div class="crew-meta" id="crew-gunner-meta"></div></div>
              <div class="crew-tile" id="crew-power"><span class="crew-seat">Power</span><span class="crew-tag" id="crew-power-tag"></span><div class="crew-meta" id="crew-power-meta"></div></div>
              <div class="crew-tile" id="crew-systems"><span class="crew-seat">Systems</span><span class="crew-tag" id="crew-systems-tag"></span><div class="crew-meta" id="crew-systems-meta"></div></div>
              <div class="crew-tile" id="crew-support"><span class="crew-seat">Support</span><span class="crew-tag" id="crew-support-tag"></span><div class="crew-meta" id="crew-support-meta"></div></div>
              <div class="loadout-card" id="loadout-card">
                <div class="loadout-header">
                  <span>Run Intel</span>
                  <span class="loadout-seed" id="loadout-seed"></span>
                </div>
                <div class="loadout-body">
                  <div class="loadout-section">
                    <h4>Weapons</h4>
                    <div class="loadout-weapons" id="loadout-weapons"></div>
                  </div>
                  <div class="loadout-section">
                    <h4>Upgrades</h4>
                    <div class="loadout-upgrades" id="loadout-upgrades"></div>
                  </div>
                  <div class="loadout-section">
                    <h4>Synergies</h4>
                    <div class="loadout-synergies" id="loadout-synergies"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="overlay" id="overlay">
      <div class="card overlay-card">
        <div class="overlay-screen" data-screen="login">
          <h2>Login</h2>
          <input type="email" id="email" placeholder="Email" />
          <input type="password" id="password" placeholder="Password" />
          <div class="actions">
            <button id="login">Login</button>
            <button id="register">Register</button>
          </div>
          <div class="room-status" id="login-status"></div>
        </div>
        <div class="overlay-screen" data-screen="menu">
          <h2>Menu</h2>
          <div class="menu-copy">Session ready. Select Play to continue.</div>
          <div class="actions">
            <button id="menu-play">Play</button>
            <button id="menu-logout">Logout</button>
          </div>
        </div>
        <div class="overlay-screen" data-screen="mode">
          <h2>Mode Selection</h2>
          <div class="mode-select">
            <label><input type="radio" name="game-mode" value="solo" /> Solo Ships</label>
            <label><input type="radio" name="game-mode" value="single" /> Solo Control</label>
            <label><input type="radio" name="game-mode" value="crew" checked /> Crew Seats</label>
          </div>
          <div class="actions">
            <button id="mode-back">Back</button>
            <button id="mode-continue">Continue</button>
          </div>
        </div>
        <div class="overlay-screen" data-screen="lobby">
          <h2>Lobby</h2>
          <div class="lobby-meta">Mode: <strong id="lobby-mode-label">Crew Seats</strong></div>
          <input type="text" id="room-code" placeholder="Room Code" />
          <div class="actions">
            <button id="quick-play">Quick Play</button>
            <button id="create-room">Create Room</button>
            <button id="join-room">Join Room</button>
            <button id="browse-rooms">Browse Rooms</button>
          </div>
          <div class="room-status" id="room-status"></div>
          <div class="room-list" id="room-list"></div>
          <div class="actions">
            <button id="lobby-back">Back</button>
          </div>
        </div>
      </div>
    </div>
    <div class="room-overlay hidden" id="room-overlay">
      <div class="card room-card">
        <h2>Lobby</h2>
        <div class="lobby-meta">Mode: <strong id="room-lobby-mode">—</strong></div>
        <div class="lobby-seats" id="room-lobby-seats"></div>
        <div class="lobby-status" id="room-lobby-status"></div>
        <div class="actions">
          <button id="room-ready">Ready</button>
          <button id="room-leave">Leave</button>
        </div>
      </div>
    </div>
    <button class="debug-fab" id="debug-fab" title="Toggle debug (\` or Ctrl+D)">Debug</button>
    <button class="settings-fab" id="settings-fab" title="Settings">Settings</button>
    <button class="stats-fab" id="stats-fab" title="Stats">Stats</button>
    <button class="menu-fab" id="menu-fab" title="Menu">Menu</button>
    <button class="admin-fab hidden" id="admin-fab" title="Admin Panel">Admin</button>
    <button class="seat-toggle" id="seat-toggle" title="Seat Controls">Seats</button>
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
    <div class="settings-overlay hidden" id="settings-overlay">
      <div class="card settings-card">
        <h2>Settings</h2>
        <div class="settings-grid">
          <div>
            <h4>Audio</h4>
            <label>Master <input type="range" id="set-master" min="0" max="100" value="80" /></label>
            <label>Music <input type="range" id="set-music" min="0" max="100" value="50" /></label>
            <label>SFX <input type="range" id="set-sfx" min="0" max="100" value="70" /></label>
          </div>
          <div>
            <h4>Camera</h4>
            <label>Distance <input type="range" id="set-cam-distance" min="3" max="16" value="8" /></label>
            <label>FOV <input type="range" id="set-cam-fov" min="50" max="95" value="70" /></label>
            <label>Smooth <input type="range" id="set-cam-smooth" min="2" max="14" value="8" /></label>
            <label><input type="checkbox" id="set-cam-shake" /> Camera Shake</label>
          </div>
          <div>
            <h4>Controls</h4>
            <label><input type="checkbox" id="set-invert-y" /> Invert Gunner Y</label>
            <label><input type="checkbox" id="set-left-handed" /> Left-handed touch</label>
            <label>Touch Scale <input type="range" id="set-touch-scale" min="70" max="130" value="100" /></label>
            <div class="keybinds" id="keybinds">
              <div class="keybind-row"><span>Pilot Forward</span><button data-bind="pilot.throttle">W</button></div>
              <div class="keybind-row"><span>Pilot Reverse</span><button data-bind="pilot.brake">S</button></div>
              <div class="keybind-row"><span>Pilot Left</span><button data-bind="pilot.left">A</button></div>
              <div class="keybind-row"><span>Pilot Right</span><button data-bind="pilot.right">D</button></div>
              <div class="keybind-row"><span>Pilot Ascend</span><button data-bind="pilot.ascend">R</button></div>
              <div class="keybind-row"><span>Pilot Descend</span><button data-bind="pilot.descend">F</button></div>
              <div class="keybind-row"><span>Boost</span><button data-bind="pilot.boost">Shift</button></div>
              <div class="keybind-row"><span>Handbrake</span><button data-bind="pilot.handbrake">Space</button></div>
              <div class="keybind-row"><span>Gunner Fire</span><button data-bind="gunner.fire">Mouse1</button></div>
              <div class="keybind-row"><span>Alt Fire</span><button data-bind="gunner.altFire">Mouse2</button></div>
              <div class="keybind-row"><span>Prev Weapon</span><button data-bind="gunner.prevWeapon">Q</button></div>
              <div class="keybind-row"><span>Next Weapon</span><button data-bind="gunner.nextWeapon">E</button></div>
            </div>
            <div class="gamepad-map" id="gamepad-map">
              <div><strong>Gamepad</strong></div>
              <div>Left Stick: steer</div>
              <div>RT/LT: throttle/brake</div>
              <div>A: handbrake</div>
              <div>B: boost</div>
              <div>Right Stick: aim</div>
              <div>RB/LB: weapon cycle</div>
              <div>RT: fire</div>
            </div>
          </div>
          <div>
            <h4>Accessibility</h4>
            <label>Reticle Size <input type="range" id="set-reticle" min="32" max="80" value="48" /></label>
            <label>Marker Outline <input type="range" id="set-mark-outline" min="80" max="160" value="110" /></label>
            <label>Text Size <input type="range" id="set-text-scale" min="80" max="120" value="100" /></label>
          </div>
        </div>
        <div class="actions">
          <button id="settings-close">Close</button>
        </div>
      </div>
    </div>
      <div class="stats-overlay hidden" id="stats-overlay">
        <div class="card stats-card">
          <h2>Run Stats</h2>
        <div class="stats-columns">
          <div>
            <h4>My Stats</h4>
            <div id="stats-me">-</div>
          </div>
          <div>
            <h4>Leaderboard</h4>
            <div id="stats-leaderboard">Loading...</div>
          </div>
        </div>
        <div class="actions">
          <button id="stats-close">Close</button>
        </div>
      </div>
      <div class="summary-overlay hidden" id="summary-overlay">
        <div class="card summary-card">
          <h2>Run Summary</h2>
          <div class="summary-grid">
            <div class="summary-cell">
              <span>Mode</span>
              <strong id="summary-mode">-</strong>
            </div>
            <div class="summary-cell">
              <span>Score</span>
              <strong id="summary-score">-</strong>
            </div>
            <div class="summary-cell">
              <span>Wave</span>
              <strong id="summary-wave">-</strong>
            </div>
            <div class="summary-cell">
              <span>Kills</span>
              <strong id="summary-kills">-</strong>
            </div>
            <div class="summary-cell">
              <span>Boss</span>
              <strong id="summary-boss">-</strong>
            </div>
            <div class="summary-cell">
              <span>Time</span>
              <strong id="summary-time">-</strong>
            </div>
          </div>
          <div class="summary-seats" id="summary-seats"></div>
          <div class="actions">
            <button id="summary-restart">Restart</button>
            <button id="summary-menu">Return to Menu</button>
          </div>
        </div>
      </div>
    </div>
    <div class="swap-flash" id="swap-flash"></div>
    <div class="swap-banner" id="swap-banner"></div>
    <div class="upgrade" id="upgrade"></div>
  </div>
`;

const overlay = document.getElementById('overlay')!;
const overlayScreens = Array.from(document.querySelectorAll<HTMLElement>('.overlay-screen'));
const lobbyModeLabel = document.getElementById('lobby-mode-label')!;
const roomOverlay = document.getElementById('room-overlay')!;
const roomLobbyMode = document.getElementById('room-lobby-mode')!;
const roomLobbySeats = document.getElementById('room-lobby-seats')!;
const roomLobbyStatus = document.getElementById('room-lobby-status')!;
const swapFlash = document.getElementById('swap-flash')!;
const swapBanner = document.getElementById('swap-banner')!;
const upgrade = document.getElementById('upgrade')!;
const seatLabel = document.getElementById('seat-label')!;
const seatIndicator = document.getElementById('seat-indicator')!;
const pilotSeatLabel = document.getElementById('pilot-seat')!;
const gunnerSeatLabel = document.getElementById('gunner-seat')!;
const powerSeatLabel = document.getElementById('power-seat')!;
const systemsSeatLabel = document.getElementById('systems-seat')!;
const supportSeatLabel = document.getElementById('support-seat')!;
const pilotMeta = document.getElementById('pilot-meta')!;
const gunnerMeta = document.getElementById('gunner-meta')!;
const powerMeta = document.getElementById('power-meta')!;
const systemsMeta = document.getElementById('systems-meta')!;
const supportMeta = document.getElementById('support-meta')!;
const comboToast = document.getElementById('combo-toast')!;
const powerBarEng = document.getElementById('power-bar-eng')!;
const powerBarWep = document.getElementById('power-bar-wep')!;
const powerBarShd = document.getElementById('power-bar-shd')!;
const powerInstability = document.getElementById('power-instability')!;
const powerHeat = document.getElementById('power-heat')!;
const powerWindow = document.getElementById('power-window')!;
const supportRadar = document.getElementById('support-radar')!;
const supportRepairWindow = document.getElementById('support-repair-window')!;
const systemsModes = document.getElementById('systems-modes')!;
const crewPilotTag = document.getElementById('crew-pilot-tag')!;
const crewGunnerTag = document.getElementById('crew-gunner-tag')!;
const crewPowerTag = document.getElementById('crew-power-tag')!;
const crewSystemsTag = document.getElementById('crew-systems-tag')!;
const crewSupportTag = document.getElementById('crew-support-tag')!;
const crewPilotMeta = document.getElementById('crew-pilot-meta')!;
const crewGunnerMeta = document.getElementById('crew-gunner-meta')!;
const crewPowerMeta = document.getElementById('crew-power-meta')!;
const crewSystemsMeta = document.getElementById('crew-systems-meta')!;
const crewSupportMeta = document.getElementById('crew-support-meta')!;
const loadoutSeed = document.getElementById('loadout-seed')!;
const loadoutWeapons = document.getElementById('loadout-weapons')!;
const loadoutUpgrades = document.getElementById('loadout-upgrades')!;
const loadoutSynergies = document.getElementById('loadout-synergies')!;
const inputStateLabel = document.getElementById('input-state')!;
const keyStateLabel = document.getElementById('key-state')!;
const loginStatus = document.getElementById('login-status')!;
const roomStatus = document.getElementById('room-status')!;
const debugConsole = document.getElementById('debug-console')!;
const debugFab = document.getElementById('debug-fab')! as HTMLButtonElement;
const settingsFab = document.getElementById('settings-fab')! as HTMLButtonElement;
const settingsOverlay = document.getElementById('settings-overlay')!;
const settingsClose = document.getElementById('settings-close')! as HTMLButtonElement;
const statsFab = document.getElementById('stats-fab')! as HTMLButtonElement;
const statsOverlay = document.getElementById('stats-overlay')!;
const statsClose = document.getElementById('stats-close')! as HTMLButtonElement;
const adminFab = document.getElementById('admin-fab')! as HTMLButtonElement;
const summaryOverlay = document.getElementById('summary-overlay')!;
const summaryMode = document.getElementById('summary-mode')!;
const summaryScore = document.getElementById('summary-score')!;
const summaryWave = document.getElementById('summary-wave')!;
const summaryKills = document.getElementById('summary-kills')!;
const summaryBoss = document.getElementById('summary-boss')!;
const summaryTime = document.getElementById('summary-time')!;
const summarySeats = document.getElementById('summary-seats')!;
const summaryRestart = document.getElementById('summary-restart')! as HTMLButtonElement;
const summaryMenu = document.getElementById('summary-menu')! as HTMLButtonElement;
const menuFab = document.getElementById('menu-fab')! as HTMLButtonElement;
const seatToggle = document.getElementById('seat-toggle')! as HTMLButtonElement;
const menuPlayButton = document.getElementById('menu-play')! as HTMLButtonElement;
const menuLogoutButton = document.getElementById('menu-logout')! as HTMLButtonElement;
const modeBackButton = document.getElementById('mode-back')! as HTMLButtonElement;
const modeContinueButton = document.getElementById('mode-continue')! as HTMLButtonElement;
const lobbyBackButton = document.getElementById('lobby-back')! as HTMLButtonElement;
const roomReadyButton = document.getElementById('room-ready')! as HTMLButtonElement;
const roomLeaveButton = document.getElementById('room-leave')! as HTMLButtonElement;
const statsMe = document.getElementById('stats-me')!;
const statsLeaderboard = document.getElementById('stats-leaderboard')!;
if (e2eVisualsEnabled) {
  overlay.classList.add('hidden');
  document.body.classList.add('e2e-scene');
}
const prefersCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
const storedSeatExpanded = localStorage.getItem('seatExpanded');
let seatExpanded = storedSeatExpanded === 'true';

function applySeatExpanded(next: boolean, persist = true) {
  seatExpanded = next;
  document.body.classList.toggle('seat-expanded', next);
  seatToggle.dataset.active = next ? 'true' : 'false';
  if (persist) {
    localStorage.setItem('seatExpanded', String(next));
  }
}

if (storedSeatExpanded === null) {
  applySeatExpanded(prefersCoarsePointer);
} else {
  applySeatExpanded(seatExpanded, false);
}

function focus3dView() {
  if (prefersCoarsePointer) return;
  const phase = (state.room?.state as { phase?: string } | null)?.phase;
  if (phase === 'running') {
    applySeatExpanded(false, false);
  }
}
const settingsInputs = {
  master: document.getElementById('set-master') as HTMLInputElement,
  music: document.getElementById('set-music') as HTMLInputElement,
  sfx: document.getElementById('set-sfx') as HTMLInputElement,
  camDistance: document.getElementById('set-cam-distance') as HTMLInputElement,
  camFov: document.getElementById('set-cam-fov') as HTMLInputElement,
  camSmooth: document.getElementById('set-cam-smooth') as HTMLInputElement,
  camShake: document.getElementById('set-cam-shake') as HTMLInputElement,
  invertY: document.getElementById('set-invert-y') as HTMLInputElement,
  leftHanded: document.getElementById('set-left-handed') as HTMLInputElement,
  touchScale: document.getElementById('set-touch-scale') as HTMLInputElement,
  reticle: document.getElementById('set-reticle') as HTMLInputElement,
  markOutline: document.getElementById('set-mark-outline') as HTMLInputElement,
  textScale: document.getElementById('set-text-scale') as HTMLInputElement
};
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

type OverlayScreen = 'login' | 'menu' | 'mode' | 'lobby';

const overlayModeLabels: Record<GameMode, string> = {
  crew: 'Crew Seats',
  solo: 'Solo Ships',
  single: 'Solo Control'
};

let roomReady = false;
let isConnecting = false;
let isAuthPending = false;
let lobbyActionButtons: HTMLButtonElement[] = [];
let lobbyInputs: HTMLInputElement[] = [];
let authActionButtons: HTMLButtonElement[] = [];
let authInputs: HTMLInputElement[] = [];
let refreshPromise: Promise<boolean> | null = null;

function isAdminUser() {
  return state.userEmail.trim().toLowerCase() === 'zirkumflex567@gmail.com';
}

function syncAdminButton() {
  adminFab.classList.toggle('hidden', !isAdminUser());
}

function setLobbyBusy(busy: boolean, message?: string) {
  lobbyActionButtons.forEach((button) => {
    button.disabled = busy;
  });
  lobbyInputs.forEach((input) => {
    input.disabled = busy;
  });
  if (typeof message === 'string') {
    roomStatus.textContent = message;
  }
}

function setAuthBusy(busy: boolean, message?: string) {
  authActionButtons.forEach((button) => {
    button.disabled = busy;
  });
  authInputs.forEach((input) => {
    input.disabled = busy;
  });
  if (typeof message === 'string') {
    loginStatus.textContent = message;
  }
}

function updateAuthHeaders(options: RequestInit) {
  const headers = new Headers(options.headers ?? {});
  if (state.accessToken) {
    headers.set('Authorization', `Bearer ${state.accessToken}`);
  }
  return { ...options, headers };
}

async function refreshSession() {
  if (refreshPromise) return refreshPromise;
  if (!state.refreshToken) return false;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${serverUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: state.refreshToken })
      });
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      if (!data?.accessToken || !data?.refreshToken) return false;
      state.accessToken = data.accessToken;
      state.refreshToken = data.refreshToken;
      localStorage.setItem('accessToken', state.accessToken);
      localStorage.setItem('refreshToken', state.refreshToken);
      updateDebugMeta();
      syncAdminButton();
      return true;
    } catch {
      return false;
    }
  })();
  const result = await refreshPromise;
  refreshPromise = null;
  if (!result) {
    state.accessToken = '';
    state.refreshToken = '';
    state.userEmail = '';
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userEmail');
    updateDebugMeta();
    syncAdminButton();
    if (!e2eVisualsEnabled) {
      setOverlayScreen('login');
    }
  }
  return result;
}

function updateRoomLobby() {
  if (!state.room || e2eVisualsEnabled) {
    roomOverlay.classList.add('hidden');
    return;
  }
  if (!summaryOverlay.classList.contains('hidden')) {
    roomOverlay.classList.add('hidden');
    return;
  }
  const roomState = state.room.state as { phase?: string; mode?: GameMode; players?: Map<string, any> };
  const phase = roomState.phase ?? 'running';
  if (phase !== 'lobby') {
    roomOverlay.classList.add('hidden');
    return;
  }
  if (document.pointerLockElement === arena) {
    document.exitPointerLock();
  }
  roomOverlay.classList.remove('hidden');
  roomLobbyMode.textContent = overlayModeLabels[roomState.mode ?? state.mode] ?? (roomState.mode ?? state.mode);
  const seatOrder: SeatType[] = ['pilot', 'gunner', 'power', 'systems', 'support'];
  const entries: Array<{ seat: SeatType; label: string; ready: boolean; isBot: boolean }> = [];
  roomState.players?.forEach((player) => {
    entries.push({
      seat: player.seat as SeatType,
      label: player.isBot ? 'BOT' : String(player.id).slice(0, 4),
      ready: Boolean(player.ready),
      isBot: Boolean(player.isBot)
    });
  });
  entries.sort((a, b) => seatOrder.indexOf(a.seat) - seatOrder.indexOf(b.seat));
  roomLobbySeats.innerHTML = entries
    .map((entry) => {
      const status = entry.isBot ? 'BOT' : entry.ready ? 'READY' : 'WAIT';
      const badgeClass = entry.isBot ? 'bot' : entry.ready ? 'ready' : 'wait';
      return `
        <div class="lobby-row">
          <span class="lobby-seat">${entry.seat.toUpperCase()}</span>
          <span class="lobby-name">${entry.label}</span>
          <span class="lobby-badge ${badgeClass}">${status}</span>
        </div>
      `;
    })
    .join('');
  const humans = entries.filter((entry) => !entry.isBot);
  const readyCount = humans.filter((entry) => entry.ready).length;
  roomLobbyStatus.textContent =
    humans.length === 0
      ? 'Waiting for players...'
      : readyCount === humans.length
        ? 'All players ready. Launching...'
        : `Ready ${readyCount}/${humans.length}`;
  let localReady = false;
  roomState.players?.forEach((player) => {
    if (player.id === state.playerId) {
      localReady = Boolean(player.ready);
    }
  });
  roomReady = localReady;
  roomReadyButton.textContent = roomReady ? 'Unready' : 'Ready';
}

function updateLobbyModeLabel() {
  lobbyModeLabel.textContent = overlayModeLabels[state.mode] ?? state.mode;
}

function syncModeInputs() {
  document.querySelectorAll<HTMLInputElement>('input[name="game-mode"]').forEach((input) => {
    input.checked = input.value === state.mode;
  });
}

function setOverlayScreen(screen: OverlayScreen) {
  overlayScreens.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.screen === screen);
  });
  overlay.dataset.screen = screen;
  overlay.classList.remove('hidden');
  if (screen === 'lobby') {
    updateLobbyModeLabel();
  } else if (screen === 'mode') {
    syncModeInputs();
  } else {
    roomStatus.textContent = '';
    roomList.innerHTML = '';
  }
  if (screen !== 'login') {
    loginStatus.textContent = '';
  }
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

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  if (target.tagName === 'BUTTON') {
    playSfx('click', { volume: 0.25, rate: 1 });
  }
});

type ClientSettings = {
  master: number;
  music: number;
  sfx: number;
  cameraDistance: number;
  cameraFov: number;
  cameraSmooth: number;
  cameraShake: boolean;
  invertY: boolean;
  leftHanded: boolean;
  touchScale: number;
  reticleSize: number;
  markOutline: number;
  textScale: number;
};

const defaultSettings: ClientSettings = {
  master: 80,
  music: 50,
  sfx: 70,
  cameraDistance: 8,
  cameraFov: 70,
  cameraSmooth: 8,
  cameraShake: true,
  invertY: false,
  leftHanded: false,
  touchScale: 100,
  reticleSize: 48,
  markOutline: 110,
  textScale: 100
};

let settings: ClientSettings = loadSettings();

type SfxKey =
  | 'laser'
  | 'cannon'
  | 'rocket'
  | 'explosion'
  | 'boost'
  | 'scan'
  | 'repair'
  | 'emp'
  | 'shield'
  | 'slow'
  | 'overdrive'
  | 'swap'
  | 'click'
  | 'engine';

const sfxPaths: Record<SfxKey, string> = {
  laser: '/assets/sfx/laserthing.wav',
  cannon: '/assets/sfx/laserthing2.wav',
  rocket: '/assets/sfx/laserthing2.wav',
  explosion: '/assets/sfx/mechanical_explosion.wav',
  boost: '/assets/sfx/space_ship.ogg',
  scan: '/assets/sfx/sound_click.wav',
  repair: '/assets/sfx/sound_click.wav',
  emp: '/assets/sfx/sound_click.wav',
  shield: '/assets/sfx/sound_click.wav',
  slow: '/assets/sfx/sound_click.wav',
  overdrive: '/assets/sfx/sound_click.wav',
  swap: '/assets/sfx/sound_click.wav',
  click: '/assets/sfx/sound_click.wav',
  engine: '/assets/sfx/space_ship.ogg'
};

const audioState = {
  ctx: null as AudioContext | null,
  masterGain: null as GainNode | null,
  sfxGain: null as GainNode | null,
  buffers: new Map<SfxKey, AudioBuffer>(),
  loops: new Map<SfxKey, { source: AudioBufferSourceNode; gain: GainNode }>(),
  unlocked: false
};

function initAudio() {
  if (audioState.ctx) return;
  audioState.ctx = new AudioContext();
  audioState.masterGain = audioState.ctx.createGain();
  audioState.sfxGain = audioState.ctx.createGain();
  audioState.sfxGain.connect(audioState.masterGain);
  audioState.masterGain.connect(audioState.ctx.destination);
  void preloadSfx();
  syncAudioGains();
}

function syncAudioGains() {
  if (!audioState.masterGain || !audioState.sfxGain) return;
  audioState.masterGain.gain.value = settings.master / 100;
  audioState.sfxGain.gain.value = settings.sfx / 100;
}

async function preloadSfx() {
  const entries = Object.entries(sfxPaths) as Array<[SfxKey, string]>;
  for (const [key, url] of entries) {
    await loadSfx(key, url);
  }
}

async function loadSfx(key: SfxKey, url: string) {
  if (!audioState.ctx || audioState.buffers.has(key)) return;
  try {
    const response = await fetch(url);
    const data = await response.arrayBuffer();
    const buffer = await audioState.ctx.decodeAudioData(data);
    audioState.buffers.set(key, buffer);
  } catch (error) {
    addLog('error', `Failed to load SFX: ${key}`, error);
  }
}

function ensureAudio() {
  initAudio();
  if (audioState.ctx && audioState.ctx.state === 'suspended') {
    audioState.ctx.resume().catch(() => undefined);
  }
  audioState.unlocked = true;
}

function playSfx(key: SfxKey, options?: { volume?: number; rate?: number }) {
  if (!audioState.ctx || !audioState.sfxGain || settings.sfx <= 0) return;
  const buffer = audioState.buffers.get(key);
  if (!buffer) return;
  const source = audioState.ctx.createBufferSource();
  source.buffer = buffer;
  if (options?.rate) source.playbackRate.value = options.rate;
  const gainNode = audioState.ctx.createGain();
  gainNode.gain.value = (options?.volume ?? 1) * (settings.sfx / 100);
  source.connect(gainNode);
  gainNode.connect(audioState.sfxGain);
  source.start(0);
}

function startLoop(key: SfxKey, volume = 0.5) {
  if (!audioState.ctx || !audioState.sfxGain || audioState.loops.has(key) || settings.sfx <= 0) return;
  const buffer = audioState.buffers.get(key);
  if (!buffer) return;
  const source = audioState.ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gainNode = audioState.ctx.createGain();
  gainNode.gain.value = volume * (settings.sfx / 100);
  source.connect(gainNode);
  gainNode.connect(audioState.sfxGain);
  source.start(0);
  audioState.loops.set(key, { source, gain: gainNode });
}

function setLoopVolume(key: SfxKey, volume: number) {
  const loop = audioState.loops.get(key);
  if (!loop) return;
  loop.gain.gain.value = volume * (settings.sfx / 100);
}

function stopLoop(key: SfxKey) {
  const loop = audioState.loops.get(key);
  if (!loop) return;
  loop.source.stop();
  audioState.loops.delete(key);
}

document.addEventListener('pointerdown', ensureAudio, { once: true });
document.addEventListener('keydown', ensureAudio, { once: true });

function loadSettings(): ClientSettings {
  try {
    const stored = localStorage.getItem('settings');
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {
    // ignore
  }
  return { ...defaultSettings };
}

function saveSettings() {
  localStorage.setItem('settings', JSON.stringify(settings));
}

function applySettings() {
  cameraState.targetDistance = settings.cameraDistance;
  cameraState.distance = settings.cameraDistance;
  cameraState.smoothing = settings.cameraSmooth;
  camera.fov = settings.cameraFov;
  camera.updateProjectionMatrix();
  document.documentElement.style.setProperty('--reticle-size', `${settings.reticleSize}px`);
  document.documentElement.style.setProperty('--mark-scale', `${settings.markOutline / 110}`);
  document.documentElement.style.setProperty('--ui-scale', `${settings.textScale / 100}`);
  document.body.dataset.hand = settings.leftHanded ? 'left' : 'right';
  const scale = settings.touchScale / 100;
  document.querySelectorAll('.controls').forEach((el) => {
    (el as HTMLElement).style.transform = `scale(${scale})`;
    (el as HTMLElement).style.transformOrigin = 'center';
  });
  syncAudioGains();
}

function syncSettingsUI() {
  settingsInputs.master.value = settings.master.toString();
  settingsInputs.music.value = settings.music.toString();
  settingsInputs.sfx.value = settings.sfx.toString();
  settingsInputs.camDistance.value = settings.cameraDistance.toString();
  settingsInputs.camFov.value = settings.cameraFov.toString();
  settingsInputs.camSmooth.value = settings.cameraSmooth.toString();
  settingsInputs.camShake.checked = settings.cameraShake;
  settingsInputs.invertY.checked = settings.invertY;
  settingsInputs.leftHanded.checked = settings.leftHanded;
  settingsInputs.touchScale.value = settings.touchScale.toString();
  settingsInputs.reticle.value = settings.reticleSize.toString();
  settingsInputs.markOutline.value = settings.markOutline.toString();
  settingsInputs.textScale.value = settings.textScale.toString();
}

settingsFab.addEventListener('click', () => {
  settingsOverlay.classList.remove('hidden');
});

  menuFab.addEventListener('click', () => {
    void leaveRoomToMenu();
  });

  adminFab.addEventListener('click', () => {
    window.open(adminUrl, '_blank');
  });

  roomReadyButton.addEventListener('click', () => {
    if (!state.room) return;
    state.room.send('ready', { ready: !roomReady });
  });

  roomLeaveButton.addEventListener('click', () => {
    void leaveRoomToMenu();
  });

seatToggle.addEventListener('click', () => {
  const next = !document.body.classList.contains('seat-expanded');
  applySeatExpanded(next);
});

settingsClose.addEventListener('click', () => {
  settingsOverlay.classList.add('hidden');
});

Object.entries(settingsInputs).forEach(([key, input]) => {
  input.addEventListener('input', () => {
    switch (key) {
      case 'master':
      case 'music':
      case 'sfx':
      case 'touchScale':
      case 'reticle':
      case 'markOutline':
      case 'textScale':
        settings = {
          ...settings,
          [
            key === 'reticle'
              ? 'reticleSize'
              : key === 'markOutline'
                ? 'markOutline'
                : key === 'textScale'
                  ? 'textScale'
                  : key
          ]:
            Number(input.value)
        } as ClientSettings;
        break;
      case 'camDistance':
        settings.cameraDistance = Number(input.value);
        break;
      case 'camFov':
        settings.cameraFov = Number(input.value);
        break;
      case 'camSmooth':
        settings.cameraSmooth = Number(input.value);
        break;
      case 'camShake':
        settings.cameraShake = (input as HTMLInputElement).checked;
        break;
      case 'invertY':
        settings.invertY = (input as HTMLInputElement).checked;
        break;
      case 'leftHanded':
        settings.leftHanded = (input as HTMLInputElement).checked;
        break;
    }
    applySettings();
    saveSettings();
  });
});

async function loadStats() {
  statsMe.textContent = 'Loading...';
  statsLeaderboard.textContent = 'Loading...';
  try {
    const me = state.accessToken
      ? await requestJson(
          '/leaderboard/me',
          { method: 'GET', headers: { Authorization: `Bearer ${state.accessToken}` } },
          'leaderboard me'
        )
      : null;
    const board = await requestJson('/leaderboard/top', { method: 'GET' }, 'leaderboard top');
    if (me?.data?.me) {
      const row = me.data.me;
      statsMe.textContent = `Best ${row.bestScore} | Runs ${row.totalRuns} | Kills ${row.totalKills} | Best Wave ${row.bestWave} | Boss ${row.bestBossKills}`;
    } else {
      statsMe.textContent = 'No stats yet.';
    }
    if (Array.isArray(board.data?.leaderboard)) {
      statsLeaderboard.innerHTML = board.data.leaderboard
        .map(
          (entry: { email: string; bestScore: number; totalRuns: number }) =>
            `<div>${entry.email} — ${entry.bestScore} (${entry.totalRuns} runs)</div>`
        )
        .join('');
    } else {
      statsLeaderboard.textContent = 'Leaderboard unavailable.';
    }
  } catch (error) {
    statsMe.textContent = 'Failed to load stats.';
    statsLeaderboard.textContent = 'Failed to load leaderboard.';
  }
}

statsFab.addEventListener('click', async () => {
  statsOverlay.classList.remove('hidden');
  await loadStats();
});

  statsClose.addEventListener('click', () => {
    statsOverlay.classList.add('hidden');
  });

  summaryRestart.addEventListener('click', () => {
    hideSummary();
    roomReady = true;
    if (state.room) {
      state.room.send('ready', { ready: true });
    }
  });

  summaryMenu.addEventListener('click', () => {
    hideSummary();
    void leaveRoomToMenu();
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
let gunnerWeaponIndex = 0;
function cycleWeapon(delta: number) {
  const total = state.weapons.length;
  gunnerWeaponIndex = (gunnerWeaponIndex + delta + total) % total;
  sendInput({ seat: 'gunner', weaponIndex: gunnerWeaponIndex });
}
state.weapons.forEach((name, idx) => {
  const button = document.createElement('button');
  button.textContent = name;
  button.addEventListener('click', () => {
    gunnerWeaponIndex = idx;
    sendInput({ seat: 'gunner', weaponIndex: idx });
  });
  weaponSelect.appendChild(button);
});

let pilotAimActive = false;
let pilotAimButton: HTMLButtonElement | null = null;

function setSeat(seat: SeatType) {
  state.seat = seat;
  seatLabel.textContent = `You are: ${seat.toUpperCase()}`;
  seatIndicator.textContent = `${seat.toUpperCase()} SEAT`;
  seatIndicator.setAttribute('data-seat', seat);
  document.body.dataset.seat = seat;
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
  const panel = document.getElementById(`${seat}-panel`);
  panel?.classList.add('active');
  document.querySelectorAll('.crew-tile').forEach((tile) => tile.classList.remove('active'));
  const crewTile = document.getElementById(`crew-${seat}`);
  crewTile?.classList.add('active');
  if (seat !== 'pilot') {
    keyState.throttle = false;
    keyState.brake = false;
    keyState.left = false;
    keyState.right = false;
    keyState.ascend = false;
    keyState.descend = false;
    keyState.boost = false;
    keyState.handbrake = false;
    pilotAxis = { x: 0, y: 0 };
    pilotLiftAxis = 0;
    if (pilotAimActive) {
      pilotAimActive = false;
      if (pilotAimButton) {
        pilotAimButton.dataset.active = 'false';
        pilotAimButton.textContent = 'Aim Move';
      }
    }
  }
  if (seat !== 'gunner' && document.pointerLockElement === arena) {
    document.exitPointerLock();
  }
  updateDebugMeta();
}

if (e2eMode) {
  (window as unknown as { __htownSetSeat?: (seat: SeatType) => void }).__htownSetSeat = (seat: SeatType) => {
    setSeat(seat);
  };
  (window as unknown as {
    __htownGetRoomSnapshot?: () => { mode: GameMode | null; shipCount: number; playerCount: number };
  }).__htownGetRoomSnapshot = () => {
    const roomState = state.room?.state as
      | { mode?: GameMode; ships?: { forEach?: (cb: (ship: any, id: string) => void) => void }; players?: { size?: number } }
      | undefined;
    const ships = roomState?.ships;
    let shipCount = 0;
    if (ships?.forEach) {
      ships.forEach(() => {
        shipCount += 1;
      });
    }
    const playerCount = roomState?.players?.size ?? 0;
    return { mode: roomState?.mode ?? null, shipCount, playerCount };
  };
}

function resolveLocalSeat() {
  if (e2eSeat) {
    if (state.seat !== e2eSeat) setSeat(e2eSeat);
    return;
  }
  if (getRoomMode() === 'solo') {
    if (state.seat !== 'pilot') setSeat('pilot');
    return;
  }
  const players = state.room?.state?.players as
    | { get?: (key: string) => { seat: SeatType; id: string; isBot?: boolean; connected?: boolean } | undefined; forEach?: (cb: (p: any) => void) => void }
    | undefined;
  if (!players) return;
  let seat: SeatType | undefined;
  const direct = players.get?.(state.playerId);
  if (direct?.seat) seat = direct.seat as SeatType;
  if (!seat) {
    players.forEach?.((player: { seat: SeatType; id: string }) => {
      if (player.id === state.playerId) seat = player.seat;
    });
  }
  if (!seat) {
    const humanSeats: SeatType[] = [];
    players.forEach?.((player: { seat: SeatType; isBot?: boolean; connected?: boolean }) => {
      if (!player.isBot && player.connected) humanSeats.push(player.seat);
    });
    if (humanSeats.length === 1) seat = humanSeats[0];
  }
  if (seat && seat !== state.seat) setSeat(seat);
}

function sendInput(input: PlayerInput) {
  if (!state.room) return;
  const phase = (state.room.state as { phase?: string } | null)?.phase;
  if (phase && phase !== 'running') return;
  state.room.send('input', input);
}

const pilotBoost = document.getElementById('pilot-boost')! as HTMLButtonElement;
pilotAimButton = document.getElementById('pilot-aim')! as HTMLButtonElement;
const pilotStick = document.getElementById('pilot-stick')!;
const gunnerStick = document.getElementById('gunner-stick')!;
const gunnerFire = document.getElementById('gunner-fire')! as HTMLButtonElement;

let pilotAxis = { x: 0, y: 0 };
let pilotLiftAxis = 0;
let gunnerAxis = { x: 1, y: 0 };
const localActions = {
  pilot: {
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
    boost: false,
    ascend: false,
    descend: false
  },
  gunner: {
    aimYaw: 0,
    aimPitch: 0,
    fire: false,
    altFire: false,
    swapWeapon: 0
  },
  power: {
    preset: 'balanced' as 'attack' | 'defense' | 'speed' | 'balanced',
    engines: 0.33,
    weapons: 0.33,
    shields: 0.34
  },
  systems: {
    abilityIndex: -1
  },
  support: {
    action: null as null | 'repair' | 'scan' | 'loot',
    hold: false,
    radar: false
  }
};

type KeybindAction =
  | 'pilot.throttle'
  | 'pilot.brake'
  | 'pilot.left'
  | 'pilot.right'
  | 'pilot.ascend'
  | 'pilot.descend'
  | 'pilot.boost'
  | 'pilot.handbrake'
  | 'gunner.fire'
  | 'gunner.altFire'
  | 'gunner.prevWeapon'
  | 'gunner.nextWeapon';

const defaultKeybinds: Record<KeybindAction, string> = {
  'pilot.throttle': 'KeyW',
  'pilot.brake': 'KeyS',
  'pilot.left': 'KeyA',
  'pilot.right': 'KeyD',
  'pilot.ascend': 'KeyR',
  'pilot.descend': 'KeyF',
  'pilot.boost': 'ShiftLeft',
  'pilot.handbrake': 'Space',
  'gunner.fire': 'Mouse0',
  'gunner.altFire': 'Mouse2',
  'gunner.prevWeapon': 'KeyQ',
  'gunner.nextWeapon': 'KeyE'
};

const altKeybinds: Partial<Record<KeybindAction, string[]>> = {
  'pilot.throttle': ['ArrowUp'],
  'pilot.brake': ['ArrowDown'],
  'pilot.left': ['ArrowLeft'],
  'pilot.right': ['ArrowRight'],
  'pilot.ascend': ['PageUp'],
  'pilot.descend': ['PageDown']
};

function loadKeybinds() {
  try {
    const stored = localStorage.getItem('keybinds');
    if (stored) return { ...defaultKeybinds, ...JSON.parse(stored) } as Record<KeybindAction, string>;
  } catch {
    // ignore
  }
  return { ...defaultKeybinds };
}

let keybinds = loadKeybinds();
let keybindIndex = new Map<string, KeybindAction>();
let listeningAction: KeybindAction | null = null;
const keybindContainer = document.getElementById('keybinds');
const keybindButtons = new Map<KeybindAction, HTMLButtonElement>();

function saveKeybinds() {
  localStorage.setItem('keybinds', JSON.stringify(keybinds));
}

function buildKeybindIndex() {
  const index = new Map<string, KeybindAction>();
  (Object.keys(keybinds) as KeybindAction[]).forEach((action) => {
    const code = keybinds[action];
    if (code) index.set(code, action);
  });
  Object.entries(altKeybinds).forEach(([action, codes]) => {
    if (!codes) return;
    codes.forEach((code) => {
      if (!index.has(code)) index.set(code, action as KeybindAction);
    });
  });
  return index;
}

function formatKey(code: string) {
  if (code === 'Mouse0') return 'Mouse1';
  if (code === 'Mouse1') return 'Mouse2';
  if (code === 'Mouse2') return 'Mouse3';
  if (code.startsWith('Key')) return code.replace('Key', '');
  if (code.startsWith('Digit')) return code.replace('Digit', '');
  if (code.startsWith('Arrow')) return code.replace('Arrow', 'Arrow ');
  if (code === 'Space') return 'Space';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
  return code;
}

function syncKeybindButtons() {
  if (!keybindContainer) return;
  keybindButtons.clear();
  keybindContainer.querySelectorAll<HTMLButtonElement>('button[data-bind]').forEach((button) => {
    const action = button.dataset.bind as KeybindAction;
    keybindButtons.set(action, button);
    button.textContent = formatKey(keybinds[action]);
    button.classList.remove('listening');
    button.addEventListener('click', () => {
      listeningAction = action;
      keybindButtons.forEach((btn) => btn.classList.remove('listening'));
      button.classList.add('listening');
      button.textContent = 'Press key';
    });
  });
}

keybindIndex = buildKeybindIndex();
syncKeybindButtons();

function clampAxis(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function lerpAngle(a: number, b: number, t: number) {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

function updatePilotAxisFromActions() {
  const steer = clampAxis(localActions.pilot.steer) * -1;
  const throttle = Math.max(0, Math.min(1, localActions.pilot.throttle));
  const brake = Math.max(0, Math.min(1, localActions.pilot.brake));
  pilotAxis = { x: steer, y: -(throttle - brake) };
}

function sendPilotInput() {
  updatePilotAxisFromActions();
  pilotLiftAxis = (localActions.pilot.ascend ? 1 : 0) - (localActions.pilot.descend ? 1 : 0);
  sendInput({
    seat: 'pilot',
    move: pilotAxis,
    lift: pilotLiftAxis,
    boost: localActions.pilot.boost,
    throttle: localActions.pilot.throttle,
    brake: localActions.pilot.brake,
    steer: localActions.pilot.steer,
    handbrake: localActions.pilot.handbrake
  });
}

function setGunnerAimFromVector(vec: { x: number; y: number }) {
  const len = Math.hypot(vec.x, vec.y) || 1;
  const norm = { x: vec.x / len, y: vec.y / len };
  gunnerAxis = norm;
  localActions.gunner.aimYaw = Math.atan2(norm.y, norm.x);
}

function updateGunnerAxisFromAngles() {
  const yaw = localActions.gunner.aimYaw;
  const pitch = localActions.gunner.aimPitch;
  const cosPitch = Math.cos(pitch);
  gunnerAxis = { x: Math.cos(yaw) * cosPitch, y: Math.sin(yaw) * cosPitch };
}

function sendGunnerInput() {
  sendInput({
    seat: 'gunner',
    aim: gunnerAxis,
    fire: localActions.gunner.fire,
    altFire: localActions.gunner.altFire,
    swapWeapon: Boolean(localActions.gunner.swapWeapon),
    weaponIndex: gunnerWeaponIndex
  });
}

function applyGamepadInputs() {
  const pads = navigator.getGamepads?.();
  const pad = pads?.[0];
  if (!pad) return;

  if (state.seat === 'pilot') {
    const steer = pad.axes[0] ?? 0;
    const stickY = -(pad.axes[1] ?? 0);
    const throttleTrigger = pad.buttons[7]?.value ?? 0;
    const brakeTrigger = pad.buttons[6]?.value ?? 0;
    localActions.pilot.steer = steer;
    localActions.pilot.throttle = throttleTrigger > 0.05 ? throttleTrigger : Math.max(0, stickY);
    localActions.pilot.brake = brakeTrigger > 0.05 ? brakeTrigger : Math.max(0, -stickY);
    localActions.pilot.handbrake = pad.buttons[0]?.pressed ?? false;
    localActions.pilot.boost = pad.buttons[1]?.pressed ?? false;
    localActions.pilot.ascend = pad.buttons[4]?.pressed ?? false;
    localActions.pilot.descend = pad.buttons[5]?.pressed ?? false;
    pilotBoost.dataset.active = localActions.pilot.boost ? 'true' : 'false';
    sendPilotInput();
  }

  if (state.seat === 'gunner' || isSoloControlMode()) {
    const aimX = pad.axes[2] ?? 0;
    const aimY = pad.axes[3] ?? 0;
    if (Math.hypot(aimX, aimY) > 0.15) {
      setGunnerAimFromVector({ x: aimX, y: aimY });
    }
    localActions.gunner.fire = pad.buttons[7]?.pressed ?? false;
    localActions.gunner.altFire = pad.buttons[6]?.pressed ?? false;
    const lb = pad.buttons[4]?.pressed ?? false;
    const rb = pad.buttons[5]?.pressed ?? false;
    if (lb && !gamepadState.lb) cycleWeapon(-1);
    if (rb && !gamepadState.rb) cycleWeapon(1);
    gamepadState.lb = lb;
    gamepadState.rb = rb;
    gunnerFire.dataset.active = localActions.gunner.fire ? 'true' : 'false';
    sendGunnerInput();
  }
}

function resolveCameraCollision(origin: THREE.Vector3, desired: THREE.Vector3) {
  const direction = new THREE.Vector3().subVectors(desired, origin);
  const maxDistance = direction.length();
  if (maxDistance < 0.0001) return { position: desired, collided: false };
  direction.normalize();
  let collided = false;
  let closestT = 1;
  for (const obstacle of cameraObstacles) {
    const toCenter = new THREE.Vector3().subVectors(obstacle.center, origin);
    const t = toCenter.dot(direction);
    if (t < 0 || t > maxDistance) continue;
    const closestPoint = new THREE.Vector3().copy(origin).addScaledVector(direction, t);
    const distSq = closestPoint.distanceToSquared(obstacle.center);
    const radiusSq = obstacle.radius * obstacle.radius;
    if (distSq <= radiusSq) {
      const offset = Math.sqrt(radiusSq - distSq);
      const hitT = (t - offset) / maxDistance;
      if (hitT < closestT) {
        closestT = Math.max(0.1, hitT);
        collided = true;
      }
    }
  }
  const position = new THREE.Vector3().copy(origin).addScaledVector(direction, maxDistance * closestT);
  return { position, collided };
}

setupStick(pilotStick, (vec) => {
  const thrust = -vec.y;
  localActions.pilot.steer = vec.x;
  localActions.pilot.throttle = Math.max(0, thrust);
  localActions.pilot.brake = Math.max(0, -thrust);
  updatePilotAxisFromActions();
  sendPilotInput();
});

setupStick(gunnerStick, (vec) => {
  setGunnerAimFromVector({ x: vec.x, y: -vec.y });
  sendGunnerInput();
});

pilotBoost.addEventListener('click', () => {
  localActions.pilot.boost = !localActions.pilot.boost;
  pilotBoost.dataset.active = localActions.pilot.boost ? 'true' : 'false';
  sendPilotInput();
});

pilotAimButton.addEventListener('click', () => {
  pilotAimActive = !pilotAimActive;
  pilotAimButton.dataset.active = pilotAimActive ? 'true' : 'false';
  pilotAimButton.textContent = pilotAimActive ? 'Aim Move: On' : 'Aim Move';
  if (!pilotAimActive) {
    localActions.pilot.steer = 0;
    localActions.pilot.throttle = 0;
    localActions.pilot.brake = 0;
    localActions.pilot.ascend = false;
    localActions.pilot.descend = false;
    pilotLiftAxis = 0;
    sendPilotInput();
  }
});

gunnerFire.addEventListener('click', () => {
  localActions.gunner.fire = !localActions.gunner.fire;
  gunnerFire.dataset.active = localActions.gunner.fire ? 'true' : 'false';
  sendGunnerInput();
});

const keyState = {
  throttle: false,
  brake: false,
  left: false,
  right: false,
  ascend: false,
  descend: false,
  boost: false,
  handbrake: false
};

function updatePilotFromKeys() {
  localActions.pilot.steer = (keyState.right ? 1 : 0) - (keyState.left ? 1 : 0);
  localActions.pilot.throttle = keyState.throttle ? 1 : 0;
  localActions.pilot.brake = keyState.brake ? 1 : 0;
  localActions.pilot.boost = keyState.boost;
  localActions.pilot.handbrake = keyState.handbrake;
  localActions.pilot.ascend = keyState.ascend;
  localActions.pilot.descend = keyState.descend;
  pilotLiftAxis = (keyState.ascend ? 1 : 0) - (keyState.descend ? 1 : 0);
  pilotBoost.dataset.active = localActions.pilot.boost ? 'true' : 'false';
  sendPilotInput();
  arenaDebug.textContent = `Input: ${pilotAxis.x.toFixed(2)}, ${pilotAxis.y.toFixed(2)}${localActions.pilot.boost ? ' BOOST' : ''}`;
  inputStateLabel.textContent = `Input ${pilotAxis.x.toFixed(2)},${pilotAxis.y.toFixed(2)}${localActions.pilot.boost ? ' BOOST' : ''}`;
}

function applyKeyAction(action: KeybindAction, isDown: boolean) {
  switch (action) {
    case 'pilot.throttle':
      if (state.seat === 'pilot') keyState.throttle = isDown;
      break;
    case 'pilot.brake':
      if (state.seat === 'pilot') keyState.brake = isDown;
      break;
    case 'pilot.left':
      if (state.seat === 'pilot') keyState.left = isDown;
      break;
    case 'pilot.right':
      if (state.seat === 'pilot') keyState.right = isDown;
      break;
    case 'pilot.ascend':
      if (state.seat === 'pilot') keyState.ascend = isDown;
      break;
    case 'pilot.descend':
      if (state.seat === 'pilot') keyState.descend = isDown;
      break;
    case 'pilot.boost':
      if (state.seat === 'pilot') keyState.boost = isDown;
      break;
    case 'pilot.handbrake':
      if (state.seat === 'pilot') keyState.handbrake = isDown;
      break;
    case 'gunner.prevWeapon':
      if (isDown && (state.seat === 'gunner' || isSoloControlMode())) cycleWeapon(-1);
      break;
    case 'gunner.nextWeapon':
      if (isDown && (state.seat === 'gunner' || isSoloControlMode())) cycleWeapon(1);
      break;
    case 'gunner.fire':
      if (state.seat === 'gunner' || isSoloControlMode()) {
        localActions.gunner.fire = isDown;
        gunnerFire.dataset.active = isDown ? 'true' : 'false';
        sendGunnerInput();
      }
      break;
    case 'gunner.altFire':
      if (state.seat === 'gunner' || isSoloControlMode()) {
        localActions.gunner.altFire = isDown;
        sendGunnerInput();
      }
      break;
  }
}

function applyKey(event: KeyboardEvent, isDown: boolean) {
  const action = keybindIndex.get(event.code);
  if (action) {
    applyKeyAction(action, isDown);
  }
}

function shouldIgnoreKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

function handleKey(event: KeyboardEvent, isDown: boolean) {
  if (shouldIgnoreKey(event)) return;
  if (listeningAction) {
    if (isDown) {
      if (event.code === 'Escape') {
        listeningAction = null;
        syncKeybindButtons();
        return;
      }
      keybinds = { ...keybinds, [listeningAction]: event.code };
      keybindIndex = buildKeybindIndex();
      saveKeybinds();
      listeningAction = null;
      syncKeybindButtons();
    }
    event.preventDefault();
    return;
  }
  applyKey(event, isDown);
  keyStateLabel.textContent = `Key ${event.code} ${isDown ? 'down' : 'up'}`;
  if (state.seat === 'pilot') {
    updatePilotFromKeys();
  }
}

window.addEventListener('keydown', (event) => handleKey(event, true), { capture: true });
window.addEventListener('keyup', (event) => handleKey(event, false), { capture: true });
window.addEventListener('blur', () => {
  keyState.throttle = false;
  keyState.brake = false;
  keyState.left = false;
  keyState.right = false;
  keyState.ascend = false;
  keyState.descend = false;
  keyState.boost = false;
  keyState.handbrake = false;
  keyStateLabel.textContent = 'Key -';
  updatePilotFromKeys();
});

const powerEngines = document.getElementById('power-engines')! as HTMLInputElement;
const powerWeapons = document.getElementById('power-weapons')! as HTMLInputElement;
const powerShields = document.getElementById('power-shields')! as HTMLInputElement;

[powerEngines, powerWeapons, powerShields].forEach((slider) => {
  slider.addEventListener('input', () => {
    const total = Number(powerEngines.value) + Number(powerWeapons.value) + Number(powerShields.value);
    const norm = (value: number) => (total === 0 ? 0.33 : value / total);
    localActions.power.engines = norm(Number(powerEngines.value));
    localActions.power.weapons = norm(Number(powerWeapons.value));
    localActions.power.shields = norm(Number(powerShields.value));
    sendInput({
      seat: 'power',
      power: {
        engines: localActions.power.engines,
        weapons: localActions.power.weapons,
        shields: localActions.power.shields
      }
    });
  });
});

document.querySelectorAll('#power-panel [data-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    const preset = button.getAttribute('data-preset') as 'attack' | 'defense' | 'speed' | 'balanced';
    localActions.power.preset = preset;
    sendInput({ seat: 'power', powerPreset: preset });
  });
});

document.querySelectorAll('#systems-panel button').forEach((button) => {
  button.addEventListener('click', () => {
    const abilityIndex = Number(button.getAttribute('data-ability'));
    localActions.systems.abilityIndex = abilityIndex;
    sendInput({ seat: 'systems', systems: { abilityIndex } });
  });
});

document.querySelectorAll('#support-panel button').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.getAttribute('data-action') as 'repair' | 'scan' | 'loot';
    localActions.support.action = action;
    sendInput({ seat: 'support', support: { action } });
  });
});

async function requestJson(
  endpoint: string,
  options: RequestInit,
  label: string,
  logOptions?: { redactBody?: boolean },
  didRefresh?: boolean
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
  if (!response.ok && !didRefresh && (response.status === 401 || response.status === 403)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return requestJson(endpoint, updateAuthHeaders(options), label, logOptions, true);
    }
  }
  return { response, data };
}

function resetLocalActions() {
  pilotAxis = { x: 0, y: 0 };
  gunnerAxis = { x: 1, y: 0 };
  pilotLiftAxis = 0;
  localActions.pilot.throttle = 0;
  localActions.pilot.brake = 0;
  localActions.pilot.steer = 0;
  localActions.pilot.handbrake = false;
  localActions.pilot.boost = false;
  localActions.pilot.ascend = false;
  localActions.pilot.descend = false;
  localActions.gunner.aimYaw = 0;
  localActions.gunner.aimPitch = 0;
  localActions.gunner.fire = false;
  localActions.gunner.altFire = false;
  localActions.gunner.swapWeapon = 0;
  localActions.power.preset = 'balanced';
  localActions.power.engines = 0.33;
  localActions.power.weapons = 0.33;
  localActions.power.shields = 0.34;
  localActions.systems.abilityIndex = -1;
  localActions.support.action = null;
  keyState.throttle = false;
  keyState.brake = false;
  keyState.left = false;
  keyState.right = false;
  keyState.ascend = false;
  keyState.descend = false;
  keyState.boost = false;
  keyState.handbrake = false;
  pilotBoost.dataset.active = 'false';
  gunnerFire.dataset.active = 'false';
  powerEngines.value = '33';
  powerWeapons.value = '33';
  powerShields.value = '34';
}

function resetClientState() {
  state.room = null;
  state.playerId = '';
  state.inputs.clear();
  renderInitialized = false;
  clearAllyShips();
  setSeat('pilot');
  resetLocalActions();
  roomReady = false;
  if (document.pointerLockElement === arena) {
    document.exitPointerLock();
  }
  updateDebugMeta();
}

function hideSummary() {
  summaryOverlay.classList.add('hidden');
}

function showSummary(payload: any) {
  const minutes = Math.floor((payload.time ?? 0) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor((payload.time ?? 0) % 60)
    .toString()
    .padStart(2, '0');
  summaryMode.textContent = overlayModeLabels[state.mode] ?? state.mode;
  summaryScore.textContent = String(payload.score ?? 0);
  summaryWave.textContent = String(payload.wave ?? '-');
  summaryKills.textContent = String(payload.kills ?? '-');
  summaryBoss.textContent = String(payload.bossKills ?? '-');
  summaryTime.textContent = `${minutes}:${seconds}`;
  const seats = payload.seatStats ?? {};
  const seatLines = (seat: string) => {
    const stats = seats[seat] ?? {};
    if (seat === 'pilot') {
      return `DIST ${(stats.distance ?? 0).toFixed(0)} | BOOST ${stats.boosts ?? 0} | HB ${stats.handbrakes ?? 0}`;
    }
    if (seat === 'gunner') {
      return `K ${stats.kills ?? 0} | H ${stats.hits ?? 0} | S ${stats.shots ?? 0}`;
    }
    if (seat === 'power') {
      return `PRE ${stats.presets ?? 0} | SL ${stats.sliders ?? 0}`;
    }
    if (seat === 'systems') {
      return `USES ${stats.uses ?? 0}`;
    }
    if (seat === 'support') {
      return `SCAN ${stats.scans ?? 0} | REP ${stats.repairs ?? 0} | LOOT ${stats.loots ?? 0}`;
    }
    return '-';
  };
  summarySeats.innerHTML = ['pilot', 'gunner', 'power', 'systems', 'support']
    .map((seat) => `<div><em>${seat.toUpperCase()}</em> ${seatLines(seat)}</div>`)
    .join('');
  summaryOverlay.classList.remove('hidden');
  roomOverlay.classList.add('hidden');
  if (document.pointerLockElement === arena) {
    document.exitPointerLock();
  }
}

function handleRoomLeft() {
  resetClientState();
  roomOverlay.classList.add('hidden');
  hideSummary();
  if (e2eVisualsEnabled) return;
  if (state.accessToken) {
    setOverlayScreen(e2eMode ? 'lobby' : 'menu');
  } else {
    setOverlayScreen('login');
  }
}

function shouldConfirmLeave() {
  const phase = (state.room?.state as { phase?: string } | null)?.phase ?? 'running';
  return phase === 'running';
}

async function leaveRoomToMenu() {
  if (state.room) {
    if (shouldConfirmLeave()) {
      const confirmLeave = window.confirm('Leave the current run? Progress will be lost.');
      if (!confirmLeave) return;
    }
    try {
      await state.room.leave();
      return;
    } catch (error) {
      addLog('error', 'Room leave failed', error);
    }
  }
  handleRoomLeft();
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
  if (payload.email) {
    state.userEmail = payload.email;
    localStorage.setItem('userEmail', state.userEmail);
  }
  updateDebugMeta();
  syncAdminButton();
  if (!e2eVisualsEnabled) {
    setOverlayScreen(e2eMode ? 'lobby' : 'menu');
  }
}

function showGameover(payload: any) {
  const minutes = Math.floor((payload.time ?? 0) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor((payload.time ?? 0) % 60)
    .toString()
    .padStart(2, '0');
  const seats = payload.seatStats ?? {};
  const seatLines = (seat: string) => {
    const stats = seats[seat] ?? {};
    if (seat === 'pilot') {
      return `DIST ${(stats.distance ?? 0).toFixed(0)} | BOOST ${stats.boosts ?? 0} | HB ${stats.handbrakes ?? 0}`;
    }
    if (seat === 'gunner') {
      return `K ${stats.kills ?? 0} | H ${stats.hits ?? 0} | S ${stats.shots ?? 0}`;
    }
    if (seat === 'power') {
      return `PRE ${stats.presets ?? 0} | SL ${stats.sliders ?? 0}`;
    }
    if (seat === 'systems') {
      return `USES ${stats.uses ?? 0}`;
    }
    if (seat === 'support') {
      return `SCAN ${stats.scans ?? 0} | REP ${stats.repairs ?? 0} | LOOT ${stats.loots ?? 0}`;
    }
    return '-';
  };
  upgrade.innerHTML = `
    <strong>Run ended</strong>
    <span>Score ${payload.score ?? 0}</span>
    <span>Wave ${payload.wave ?? '-'}</span>
    <span>Kills ${payload.kills ?? '-'} | Boss ${payload.bossKills ?? '-'}</span>
    <span>Time ${minutes}:${seconds}</span>
    <div class="summary">
      <div><em>Pilot</em> ${seatLines('pilot')}</div>
      <div><em>Gunner</em> ${seatLines('gunner')}</div>
      <div><em>Power</em> ${seatLines('power')}</div>
      <div><em>Systems</em> ${seatLines('systems')}</div>
      <div><em>Support</em> ${seatLines('support')}</div>
    </div>
  `;
  upgrade.classList.add('show');
  setTimeout(() => upgrade.classList.remove('show'), 4000);
  showSummary(payload);
}

let lastLoadoutSignature = '';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toArray<T>(value: any): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : Array.from(value as Iterable<T>);
}

function getStatValue(stats: any, key: string) {
  if (!stats) return undefined;
  if (typeof stats.get === 'function') return stats.get(key);
  return stats[key];
}

function formatStatValue(key: string, value: number) {
  if (!Number.isFinite(value)) return '-';
  if (key === 'cooldownMs' || key === 'reloadMs') return `${(value / 1000).toFixed(2)}s`;
  if (key === 'critChance') return `${Math.round(value * 100)}%`;
  if (key === 'critMultiplier') return `${value.toFixed(2)}x`;
  return Math.round(value).toString();
}

function renderTagChips(tags: string[], limit = 7) {
  const safe = tags.filter(Boolean);
  const visible = safe.slice(0, limit);
  const extra = safe.length - visible.length;
  const chips = visible.map((tag) => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join('');
  return extra > 0 ? `${chips}<span class="tag-badge tag-more">+${extra}</span>` : chips;
}

function renderWeaponCard(weapon: any) {
  const rarity = weapon?.rarity ?? 'common';
  const name = escapeHtml(weapon?.name ?? 'Unknown');
  const tags = toArray<string>(weapon?.tags);
  const mods = toArray<any>(weapon?.mods);
  const quirkName = weapon?.quirkName ?? '';
  const quirkDesc = weapon?.quirkDescription ?? '';

  const statOrder: Array<[string, string]> = [
    ['damage', 'DMG'],
    ['cooldownMs', 'CD'],
    ['projectileCount', 'PEL'],
    ['burstCount', 'BST'],
    ['range', 'RNG'],
    ['critChance', 'CRIT'],
    ['critMultiplier', 'CRITx'],
    ['magazine', 'MAG'],
    ['reloadMs', 'RLD']
  ];

  const statLines = statOrder
    .map(([key, label]) => {
      const value = getStatValue(weapon?.stats, key);
      if (value === undefined) return '';
      return `<div class="stat-chip"><span>${label}</span><strong>${formatStatValue(key, value)}</strong></div>`;
    })
    .filter(Boolean)
    .join('');

  const powerScore = Number.isFinite(weapon?.powerScore)
    ? `<div class="stat-chip"><span>PWR</span><strong>${Math.round(weapon.powerScore)}</strong></div>`
    : '';

  const modItems = mods.length
    ? mods
        .map((mod) => {
          const modName = escapeHtml(mod?.name ?? 'Mod');
          const modDesc = escapeHtml(mod?.description ?? '');
          return `<span class="mod-pill" title="${modDesc}">${modName}</span>`;
        })
        .join('')
    : `<span class="mod-empty">No mods</span>`;

  const quirkItem = quirkName
    ? `<span class="mod-pill quirk" title="${escapeHtml(quirkDesc)}">Quirk: ${escapeHtml(quirkName)}</span>`
    : '';

  return `
    <div class="loadout-weapon">
      <div class="loadout-title">
        <span class="weapon-name">${name}</span>
        <span class="rarity ${escapeHtml(rarity)}">${escapeHtml(rarity)}</span>
      </div>
      <div class="stat-grid">${statLines}${powerScore}</div>
      <div class="tag-badges">${renderTagChips(tags)}</div>
      <div class="mod-list">${modItems}${quirkItem}</div>
    </div>
  `;
}

function renderUpgradeCard(upgrade: any) {
  const rarity = upgrade?.rarity ?? 'common';
  const name = escapeHtml(upgrade?.name ?? 'Upgrade');
  const description = escapeHtml(upgrade?.description ?? '');
  const tags = toArray<string>(upgrade?.tags);
  return `
    <div class="loadout-upgrade">
      <div class="loadout-title">
        <span>${name}</span>
        <span class="rarity ${escapeHtml(rarity)}">${escapeHtml(rarity)}</span>
      </div>
      <div class="loadout-desc">${description}</div>
      <div class="tag-badges">${renderTagChips(tags, 6)}</div>
    </div>
  `;
}

function renderSynergyCard(synergy: any) {
  const name = escapeHtml(synergy?.name ?? 'Synergy');
  const description = escapeHtml(synergy?.description ?? '');
  const requirements = toArray<string>(synergy?.requirements);
  return `
    <div class="loadout-synergy">
      <div class="loadout-title">
        <span>${name}</span>
      </div>
      <div class="loadout-desc">${description}</div>
      <div class="tag-badges">${renderTagChips(requirements, 8)}</div>
    </div>
  `;
}

function renderLoadout() {
  const loot = (state.room?.state as any)?.loot;
  if (!loot) {
    loadoutSeed.textContent = 'Seed —';
    loadoutWeapons.innerHTML = `<div class="loadout-empty">Waiting for loadout...</div>`;
    loadoutUpgrades.innerHTML = `<div class="loadout-empty">Waiting for loadout...</div>`;
    loadoutSynergies.innerHTML = `<div class="loadout-empty">Waiting for loadout...</div>`;
    return;
  }

  loadoutSeed.textContent = loot.seed ? `Seed ${loot.seed}` : 'Seed —';

  const weapons = toArray<any>(loot.weapons);
  const upgrades = toArray<any>(loot.upgrades);
  const synergies = toArray<any>(loot.synergies);

  const weaponSig = weapons.map((weapon) => `${weapon?.name ?? ''}:${weapon?.rarity ?? ''}`).join('|');
  const upgradeSig = upgrades.map((upgrade) => `${upgrade?.name ?? ''}:${upgrade?.rarity ?? ''}`).join('|');
  const synergySig = synergies.map((synergy) => `${synergy?.name ?? ''}`).join('|');
  const signature = `${loot.seed ?? 0}::${weaponSig}::${upgradeSig}::${synergySig}`;
  if (signature === lastLoadoutSignature) return;
  lastLoadoutSignature = signature;

  loadoutWeapons.innerHTML = weapons.length
    ? weapons.map(renderWeaponCard).join('')
    : `<div class="loadout-empty">No intel yet.</div>`;
  loadoutUpgrades.innerHTML = upgrades.length
    ? upgrades.map(renderUpgradeCard).join('')
    : `<div class="loadout-empty">No intel yet.</div>`;
  loadoutSynergies.innerHTML = synergies.length
    ? synergies.map(renderSynergyCard).join('')
    : `<div class="loadout-empty">No intel yet.</div>`;
}

async function connect(roomId?: string, modeHint?: GameMode | null, didRefresh?: boolean) {
  if (!state.accessToken) {
    addLog('warn', 'Connect blocked: missing access token.');
    if (!e2eVisualsEnabled) {
      setOverlayScreen('login');
    }
    return;
  }
  if (isConnecting) return;
  isConnecting = true;
  const connectingMessage = roomStatus.textContent ? undefined : 'Connecting...';
  setLobbyBusy(true, connectingMessage);
  try {
    if (state.room) {
      try {
        await state.room.leave();
      } catch (error) {
        addLog('error', 'Room leave failed', error);
      }
    }
    state.playerId = getTokenPayload(state.accessToken) ?? '';
    updateDebugMeta();
    const targetMode = modeHint ?? (roomId ? null : state.mode);
    const options: { userId: string; seat?: SeatType; lockSeat?: boolean; mode?: GameMode; accessToken?: string } = {
      userId: state.playerId
    };
    if (targetMode) {
      options.mode = targetMode;
    }
    if (e2eSeat) {
      options.seat = e2eSeat;
      options.lockSeat = true;
    }
    if (!e2eSeat && targetMode && targetMode !== 'crew') {
      options.seat = 'pilot';
      options.lockSeat = true;
    }
    options.accessToken = state.accessToken;
    addLog('info', 'Connecting to room', {
      roomId: roomId ?? 'matchmake',
      userId: state.playerId,
      mode: targetMode ?? 'unknown'
    });
    state.room = roomId ? await client.joinById(roomId, options) : await client.joinOrCreate('game', options);
  } catch (error) {
    addLog('error', 'Room connect failed', error);
    const message = error instanceof Error ? error.message : String(error);
    if (didRefresh || (!message.toLowerCase().includes('jwt') && !message.toLowerCase().includes('token'))) {
      throw error;
    }
    const refreshed = await refreshSession();
    if (refreshed) {
      return connect(roomId, modeHint, true);
    }
    throw error;
  } finally {
    isConnecting = false;
    setLobbyBusy(false);
  }
  overlay.classList.add('hidden');
  updateDebugMeta();
  updateRoomLobby();
  focus3dView();
  state.room.onError((code, message) => {
    addLog('error', 'Room error', { code, message });
  });
  state.room.onLeave((code) => {
    addLog('warn', 'Room left', { code });
    handleRoomLeft();
  });
  state.room.onMessage('gameover', (payload) => {
    showGameover(payload);
  });
  state.room.onMessage('achievement', (payload: { label?: string }) => {
    comboToast.textContent = payload.label ?? 'Achievement unlocked';
    comboToast.classList.add('show');
    setTimeout(() => comboToast.classList.remove('show'), 2400);
  });
  state.room.onStateChange(() => {
    const now = performance.now();
    if (lastStateAt > 0) {
      const delta = now - lastStateAt;
      if (delta > 0) {
        serverTickHz = 1000 / delta;
      }
    }
    lastStateAt = now;
    renderLoadout();
    updateRoomLobby();
  });
  const roomMode = (state.room.state as { mode?: GameMode }).mode;
  if (roomMode) {
    state.mode = roomMode;
    updateLobbyModeLabel();
    syncModeInputs();
  }
  if (typeof state.room.state.listen === 'function') {
    state.room.state.listen('mode', (value) => {
      if (value) {
        state.mode = value as GameMode;
        updateLobbyModeLabel();
        syncModeInputs();
      }
    });
    state.room.state.listen('phase', (value) => {
      if (value === 'running') {
        focus3dView();
      }
    });
  }
  let localPlayerBound = false;
  const bindLocalPlayer = (player: any, key: string) => {
    if (localPlayerBound || key !== state.playerId) return;
    localPlayerBound = true;
    setSeat(player.seat);
    if (typeof player.listen === 'function') {
      player.listen('seat', (value: SeatType) => {
        if (value !== state.seat) setSeat(value);
      });
    } else if (typeof player.onChange === 'function') {
      player.onChange(() => {
        if (player.seat !== state.seat) setSeat(player.seat);
      });
    }
  };
  state.room.state.players.onAdd = (player, key) => {
    bindLocalPlayer(player, key);
  };
  state.room.state.players.onChange = (player, key) => {
    bindLocalPlayer(player, key);
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
      swapFlash.classList.add('active');
      setTimeout(() => swapFlash.classList.remove('active'), 600);
      playSfx('swap', { volume: 0.5, rate: 1.1 });
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
  resolveLocalSeat();
  state.room.state.upgradeChoices.onAdd = () => {
    if (state.room?.state.upgradeChoices.length) {
      const allowAllSeats = getRoomMode() !== 'crew';
      const choices = allowAllSeats
        ? state.room.state.upgradeChoices
        : state.room.state.upgradeChoices.filter(
            (choice) => choice.seat === 'all' || choice.seat === state.seat
          );
      if (!choices.length) {
        upgrade.innerHTML = `<strong>Upgrade</strong><span>Waiting for seat pick...</span>`;
        upgrade.classList.add('show');
        return;
      }
      upgrade.innerHTML = choices
        .map(
          (choice) =>
            `<button data-upgrade="${choice.id}">${choice.name}<span>${choice.description}</span></button>`
        )
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
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
  const quickPlayButton = document.getElementById('quick-play')!;
  const createRoomButton = document.getElementById('create-room')!;
  const joinRoomButton = document.getElementById('join-room')!;
  const browseRoomsButton = document.getElementById('browse-rooms')!;
  const roomList = document.getElementById('room-list')!;
  const roomCodeInput = document.getElementById('room-code') as HTMLInputElement;
  if (!e2eVisualsEnabled) {
    const initialScreen: OverlayScreen = state.accessToken ? (e2eMode ? 'lobby' : 'menu') : 'login';
    setOverlayScreen(initialScreen);
  }

  authActionButtons = [loginButton, registerButton];
  authInputs = [emailInput, passwordInput];
  lobbyActionButtons = [quickPlayButton, createRoomButton, joinRoomButton, browseRoomsButton, lobbyBackButton];
  lobbyInputs = [roomCodeInput];
  
  loginButton.addEventListener('click', async () => {
    if (isAuthPending) return;
    const email = emailInput.value;
    const password = passwordInput.value;
    loginStatus.textContent = '';
    isAuthPending = true;
    setAuthBusy(true, 'Logging in...');
    try {
      await auth('/auth/login', { email, password });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed.';
      loginStatus.textContent = message;
      addLog('error', 'Login failed', { message });
    } finally {
      isAuthPending = false;
      setAuthBusy(false);
    }
  });

  registerButton.addEventListener('click', async () => {
    if (isAuthPending) return;
    const email = emailInput.value;
    const password = passwordInput.value;
    loginStatus.textContent = '';
    isAuthPending = true;
    setAuthBusy(true, 'Registering...');
    try {
      await auth('/auth/register', { email, password });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Register failed.';
      loginStatus.textContent = message;
      addLog('error', 'Register failed', { message });
    } finally {
      isAuthPending = false;
      setAuthBusy(false);
    }
  });

  menuPlayButton.addEventListener('click', () => {
    setOverlayScreen('mode');
  });

  menuLogoutButton.addEventListener('click', async () => {
    if (state.accessToken) {
      try {
        await requestJson(
          '/auth/logout',
          { method: 'POST', headers: { Authorization: `Bearer ${state.accessToken}` } },
          'logout'
        );
      } catch (error) {
        addLog('error', 'Logout failed', error);
      }
    }
    state.accessToken = '';
    state.refreshToken = '';
    state.userEmail = '';
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userEmail');
    updateDebugMeta();
    syncAdminButton();
    setOverlayScreen('login');
  });

  modeBackButton.addEventListener('click', () => {
    setOverlayScreen('menu');
  });

  modeContinueButton.addEventListener('click', () => {
    setOverlayScreen('lobby');
  });

  lobbyBackButton.addEventListener('click', () => {
    setOverlayScreen('mode');
  });

document.querySelectorAll<HTMLInputElement>('input[name="game-mode"]').forEach((input) => {
  input.addEventListener('change', () => {
    if (input.value === 'single') {
      state.mode = 'single';
    } else if (input.value === 'solo') {
      state.mode = 'solo';
    } else {
      state.mode = 'crew';
    }
    updateLobbyModeLabel();
  });
});

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
  setLobbyBusy(true, 'Creating room...');
  try {
    const { response, data } = await requestJson(
      '/matchmake/create',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: state.mode })
      },
      'create room'
    );
    if (!response.ok) {
      roomStatus.textContent = data?.error || 'Could not create room.';
      return;
    }
    roomStatus.textContent = `Room code: ${data.code}`;
    await connect(data.roomId, state.mode);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Create room failed.';
    roomStatus.textContent = message;
    addLog('error', 'Create room failed', { message });
  } finally {
    setLobbyBusy(false);
  }
});

joinRoomButton.addEventListener('click', async () => {
  if (!state.accessToken) return;
  roomStatus.textContent = '';
  const code = roomCodeInput.value;
  setLobbyBusy(true, 'Joining room...');
  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Join room failed.';
    roomStatus.textContent = message;
    addLog('error', 'Join room failed', { message });
  } finally {
    setLobbyBusy(false);
  }
});

browseRoomsButton.addEventListener('click', async () => {
  roomStatus.textContent = '';
  roomList.innerHTML = 'Loading rooms...';
  setLobbyBusy(true, 'Loading rooms...');
  try {
    const rooms = await client.getAvailableRooms('game');
    if (!rooms.length) {
      roomList.textContent = 'No open rooms yet.';
      return;
    }
      roomList.innerHTML = rooms
        .map(
          (room) => `
            <div class="room-row">
              <div><strong>${room.roomId.slice(0, 6)}</strong> · ${room.clients}/${room.maxClients} players · ${room.metadata?.mode ?? 'crew'}</div>
              <button data-room="${room.roomId}" data-mode="${room.metadata?.mode ?? ''}">Join</button>
            </div>
          `
        )
        .join('');
      roomList.querySelectorAll<HTMLButtonElement>('button[data-room]').forEach((button) => {
        button.addEventListener('click', async () => {
          const id = button.dataset.room;
          if (!id) return;
          const mode = (button.dataset.mode as GameMode | undefined) || null;
          try {
            await connect(id, mode);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Join room failed.';
            roomStatus.textContent = message;
            addLog('error', 'Join room failed', { message });
          }
        });
      });
  } catch (error) {
    roomList.textContent = 'Failed to load rooms.';
    addLog('error', 'Room browser failed', error);
  } finally {
    setLobbyBusy(false);
  }
});

updateDebugMeta();
syncAdminButton();
addLog('info', 'Debug console ready.');

const arena = document.getElementById('arena')!;
arena.tabIndex = 0;
arena.addEventListener('pointerdown', () => {
  arena.focus();
});
document.body.addEventListener('pointerdown', () => {
  if (document.activeElement !== arena) arena.focus();
});
arena.addEventListener('click', () => {
  if ((state.seat === 'gunner' || isSoloControlMode()) && document.pointerLockElement !== arena) {
    arena.requestPointerLock();
  }
});

arena.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement === arena) return;
  const canvas = arena.querySelector('canvas');
  if (state.seat === 'pilot' && pilotAimActive) {
    if (freeLookActive) return;
    if (canvas && event.target !== canvas) return;
    const rect = arena.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const len = Math.hypot(dx, dy) || 1;
    const max = Math.min(rect.width, rect.height) * 0.35;
    const clamp = Math.min(len, max) / max;
    const moveX = (dx / len) * clamp;
    const moveY = (-dy / len) * clamp;
    localActions.pilot.steer = -moveX;
    localActions.pilot.throttle = Math.max(0, -moveY);
    localActions.pilot.brake = Math.max(0, moveY);
    sendPilotInput();
    return;
  }
  if (state.seat !== 'gunner' && !isSoloControlMode()) return;
  if (canvas && event.target !== canvas) return;
  const rect = arena.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  const len = Math.hypot(dx, dy) || 1;
  const max = Math.min(rect.width, rect.height) * 0.35;
  const clamp = Math.min(len, max) / max;
  const invert = settings.invertY ? -1 : 1;
  setGunnerAimFromVector({ x: (dx / len) * clamp, y: (-dy / len) * clamp * invert });
  sendGunnerInput();
});

arena.addEventListener('wheel', (event) => {
  event.preventDefault();
  cameraState.targetDistance = Math.max(3, Math.min(16, cameraState.targetDistance + event.deltaY * 0.01));
});

let pinchStartDistance = 0;
arena.addEventListener('touchstart', (event) => {
  if (event.touches.length === 2) {
    const dx = event.touches[0].clientX - event.touches[1].clientX;
    const dy = event.touches[0].clientY - event.touches[1].clientY;
    pinchStartDistance = Math.hypot(dx, dy);
  }
});
arena.addEventListener('touchmove', (event) => {
  if (event.touches.length === 2 && pinchStartDistance) {
    const dx = event.touches[0].clientX - event.touches[1].clientX;
    const dy = event.touches[0].clientY - event.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const delta = (pinchStartDistance - dist) * 0.01;
    cameraState.targetDistance = Math.max(3, Math.min(16, cameraState.targetDistance + delta));
    pinchStartDistance = dist;
  }
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== arena) return;
  localActions.gunner.aimYaw = Math.atan2(gunnerAxis.y, gunnerAxis.x);
});

window.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== arena) return;
  if (state.seat !== 'gunner' && !isSoloControlMode()) return;
  const sensitivity = 0.0035;
  localActions.gunner.aimYaw += event.movementX * sensitivity;
  const invert = settings.invertY ? -1 : 1;
  localActions.gunner.aimPitch = Math.max(
    -0.8,
    Math.min(0.8, localActions.gunner.aimPitch - event.movementY * sensitivity * invert)
  );
  updateGunnerAxisFromAngles();
});

function isArenaTarget(event: MouseEvent) {
  const target = event.target as Node | null;
  return !!target && arena.contains(target);
}

window.addEventListener('mousedown', (event) => {
  if (!isArenaTarget(event)) return;
  if (event.button === 1 || (event.button === 2 && state.seat === 'pilot')) {
    freeLookActive = true;
  }
});

window.addEventListener('mouseup', (event) => {
  if (event.button === 1 || (event.button === 2 && state.seat === 'pilot')) {
    freeLookActive = false;
  }
});

window.addEventListener('blur', () => {
  freeLookActive = false;
});

window.addEventListener('mousemove', (event) => {
  if (!freeLookActive || document.pointerLockElement === arena) return;
  const sensitivity = 0.003;
  cameraState.yawOffset += event.movementX * sensitivity;
  cameraState.pitchOffset = Math.max(-0.9, Math.min(0.4, cameraState.pitchOffset + event.movementY * sensitivity));
});

window.addEventListener('mousedown', (event) => {
  if (state.seat !== 'gunner' && !isSoloControlMode()) return;
  if (event.button === 0) {
    localActions.gunner.fire = true;
    gunnerFire.dataset.active = 'true';
    sendGunnerInput();
  }
  if (event.button === 2) {
    localActions.gunner.altFire = true;
    sendGunnerInput();
  }
});

window.addEventListener('mouseup', (event) => {
  if (state.seat !== 'gunner') return;
  if (event.button === 0) {
    localActions.gunner.fire = false;
    gunnerFire.dataset.active = 'false';
    sendGunnerInput();
  }
  if (event.button === 2) {
    localActions.gunner.altFire = false;
    sendGunnerInput();
  }
});

window.addEventListener('contextmenu', (event) => {
  if (state.seat === 'gunner' || isSoloControlMode()) {
    event.preventDefault();
    return;
  }
  if (state.seat === 'pilot' && isArenaTarget(event)) {
    event.preventDefault();
  }
});

const arenaDebug = document.createElement('div');
arenaDebug.className = 'arena-debug';
arenaDebug.textContent = 'Input: 0,0';
arena.appendChild(arenaDebug);
const arenaHud = document.createElement('div');
arenaHud.className = 'arena-hud';
arenaHud.innerHTML = `
  <div class="vision-mask" id="vision-mask"></div>
  <div class="reticle"></div>
  <div class="speedbar">
    <div class="speedbar-fill"></div>
    <span class="speedbar-label">SPD 0</span>
  </div>
  <canvas class="mini-map" id="mini-map" width="160" height="160"></canvas>
  <div class="crew-feed" id="crew-feed"></div>
  <div class="arena-stats" id="arena-stats"></div>
  <div class="ship-status" id="ship-status"></div>
  <div class="radar" id="radar"></div>
`;
arena.appendChild(arenaHud);
const visionMask = arenaHud.querySelector('#vision-mask') as HTMLDivElement;
const reticle = arenaHud.querySelector('.reticle') as HTMLDivElement;
const speedbarFill = arenaHud.querySelector('.speedbar-fill') as HTMLDivElement;
const speedbarLabel = arenaHud.querySelector('.speedbar-label') as HTMLSpanElement;
const miniMap = arenaHud.querySelector('#mini-map') as HTMLCanvasElement;
const crewFeed = arenaHud.querySelector('#crew-feed') as HTMLDivElement;
const arenaStats = arenaHud.querySelector('#arena-stats') as HTMLDivElement;
const shipStatus = arenaHud.querySelector('#ship-status') as HTMLDivElement;
const radar = arenaHud.querySelector('#radar') as HTMLDivElement;
const miniMapCtx = miniMap?.getContext('2d');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setClearColor(0x070b16, 1);
arena.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05070f, 80, 520);

const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 6000);
camera.position.set(0, 4, 7);
camera.lookAt(0, 0, 0);
const cameraState = {
  distance: 7.5,
  targetDistance: 7.5,
  height: 2.8,
  yawOffset: 0,
  pitchOffset: -0.2,
  smoothing: 8,
  lookAhead: 3,
  collision: false
};
let freeLookActive = false;
const cameraTarget = new THREE.Vector3();
const desiredCameraPos = new THREE.Vector3();

applySettings();
syncSettingsUI();

const hemiLight = new THREE.HemisphereLight(0xbad6ff, 0x0a0f1e, 1.05);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(6, 12, 4);
scene.add(dirLight);

const rimLight = new THREE.PointLight(0x6cf6ff, 0.9, 40);
scene.add(rimLight);

const starGeometry = new THREE.BufferGeometry();
const starCount = 1600;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i += 1) {
  const idx = i * 3;
  starPositions[idx] = (Math.random() - 0.5) * 1600;
  starPositions[idx + 1] = Math.random() * 600 + 20;
  starPositions[idx + 2] = (Math.random() - 0.5) * 1600;
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xcfe7ff, size: 1.2, sizeAttenuation: false });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

const cameraObstacles: Array<{ center: THREE.Vector3; radius: number }> = [];
for (let i = 0; i < 6; i += 1) {
  const angle = (i / 6) * Math.PI * 2;
  const radius = 6 + (i % 3) * 2;
  const center = new THREE.Vector3(Math.cos(angle) * 10, 1.5 + (i % 2) * 1.2, Math.sin(angle) * 10);
  cameraObstacles.push({ center, radius });
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.6, 18, 18),
    new THREE.MeshStandardMaterial({ color: 0x1b2c47, roughness: 0.8, metalness: 0.1 })
  );
  mesh.position.copy(center);
  scene.add(mesh);
}

const empRing = new THREE.Mesh(
  new THREE.RingGeometry(10, 12, 48),
  new THREE.MeshBasicMaterial({ color: 0x6cf6ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
);
empRing.rotation.x = -Math.PI / 2;
empRing.visible = false;
scene.add(empRing);

const slowFieldRing = new THREE.Mesh(
  new THREE.RingGeometry(20, 22, 64),
  new THREE.MeshBasicMaterial({ color: 0x7cff7a, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
);
slowFieldRing.rotation.x = -Math.PI / 2;
slowFieldRing.visible = false;
scene.add(slowFieldRing);

const assetBase = '/assets/ext/spacekit2023';

const aimLinePositions = new Float32Array(6);
const gunnerAimGeometry = new THREE.BufferGeometry();
gunnerAimGeometry.setAttribute('position', new THREE.BufferAttribute(aimLinePositions, 3));
const gunnerAimMaterial = new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.6 });
const gunnerAimLine = new THREE.Line(gunnerAimGeometry, gunnerAimMaterial);
gunnerAimLine.frustumCulled = false;
scene.add(gunnerAimLine);
const markedIndicatorMaterial = new THREE.SpriteMaterial({
  color: 0xffd166,
  transparent: true,
  opacity: 0.9,
  depthTest: false
});
const markedIndicators = new Map<string, THREE.Sprite>();
const bossTelegraphMaterial = new THREE.SpriteMaterial({
  color: 0xff6b6b,
  transparent: true,
  opacity: 0.9,
  depthTest: false
});
const bossTelegraphs = new Map<string, THREE.Sprite>();

const ship = new THREE.Group();
const shipPlaceholder = new THREE.Mesh(
  new THREE.ConeGeometry(0.6, 1.6, 12),
  new THREE.MeshStandardMaterial({ color: 0x4fd1ff, roughness: 0.35, metalness: 0.2 })
);
shipPlaceholder.rotation.x = Math.PI / 2;
shipPlaceholder.position.y = 0.6;
ship.add(shipPlaceholder);
const thrusterMaterial = new THREE.MeshBasicMaterial({
  color: 0x6cf6ff,
  transparent: true,
  opacity: 0.6,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const thrusters = new THREE.Group();
const thrusterLeft = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8, 8), thrusterMaterial);
thrusterLeft.rotation.x = -Math.PI / 2;
thrusterLeft.position.set(-0.35, 0.2, -1.2);
const thrusterRight = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8, 8), thrusterMaterial);
thrusterRight.rotation.x = -Math.PI / 2;
thrusterRight.position.set(0.35, 0.2, -1.2);
thrusters.add(thrusterLeft, thrusterRight);
thrusters.userData.baseScale = thrusters.scale.clone();
ship.add(thrusters);
const headlight = new THREE.SpotLight(0x9fdcff, 1.2, 60, Math.PI / 6, 0.5, 1);
const headlightTarget = new THREE.Object3D();
headlight.position.set(0, 1.2, 0.8);
headlightTarget.position.set(0, 1.2, 6);
ship.add(headlight);
ship.add(headlightTarget);
headlight.target = headlightTarget;
const shipGlow = new THREE.PointLight(0x6cf6ff, 0.6, 22);
shipGlow.position.set(0, 0.7, 0);
ship.add(shipGlow);
const muzzleFlash = new THREE.PointLight(0xffd166, 0, 12);
muzzleFlash.position.set(0, 0.9, 1.6);
ship.add(muzzleFlash);
scene.add(ship);

const allyShips = new Map<string, THREE.Group>();
const allyShipMaterial = new THREE.MeshStandardMaterial({
  color: 0x7cffd6,
  roughness: 0.4,
  metalness: 0.2,
  emissive: 0x2fd1b2,
  emissiveIntensity: 0.4
});
function ensureAllyShip(id: string) {
  let entry = allyShips.get(id);
  if (entry) return entry;
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 10), allyShipMaterial);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = 0.5;
  group.add(mesh);
  scene.add(group);
  allyShips.set(id, group);
  return group;
}
function clearAllyShips() {
  allyShips.forEach((group) => scene.remove(group));
  allyShips.clear();
}

const powerupMaterial = new THREE.MeshStandardMaterial({ color: 0x7cff7a, roughness: 0.2, metalness: 0.2 });
const powerups = [new THREE.Group(), new THREE.Group()];
powerups[0].add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), powerupMaterial));
powerups[1].add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), powerupMaterial));
powerups[0].position.set(4, 0, 14);
powerups[1].position.set(-5, 0, 18);
powerups.forEach((mesh) => scene.add(mesh));

type EnemyKind =
  | 'chaser'
  | 'runner'
  | 'spitter'
  | 'lurker'
  | 'brute'
  | 'swarm'
  | 'boss-warden'
  | 'boss-siren'
  | 'boss-behemoth';

const enemyGeometry = new THREE.SphereGeometry(0.45, 16, 12);
const enemyMaterials: Record<string, THREE.MeshStandardMaterial> = {
  chaser: new THREE.MeshStandardMaterial({ color: 0xff4f4f, roughness: 0.4, metalness: 0.1 }),
  runner: new THREE.MeshStandardMaterial({ color: 0xffb347, roughness: 0.4, metalness: 0.1 }),
  spitter: new THREE.MeshStandardMaterial({ color: 0xb87bff, roughness: 0.4, metalness: 0.1 })
};
const enemies = new Map<string, THREE.Object3D>();
type AnimatedTemplate = {
  model: THREE.Object3D;
  animations: THREE.AnimationClip[];
};
const enemyTemplates: Partial<Record<EnemyKind, AnimatedTemplate>> = {};
const enemyMixers = new Map<string, THREE.AnimationMixer>();
const enemyPool = new Map<EnemyKind, THREE.Object3D[]>();
const powerupTemplates: Array<THREE.Object3D | null> = [null, null];
const propTemplates = new Map<string, THREE.Object3D>();
const rockTemplates: THREE.Object3D[] = [];
const caveGroup = new THREE.Group();
scene.add(caveGroup);
let caveBuilt = false;
let caveFallbackBuilt = false;
const miniMapConfig = buildMiniMapConfig();

function buildMiniMapConfig() {
  if (!miniMap) return null;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of cavePath) {
    const radius = point.radius ?? caveBaseRadius;
    minX = Math.min(minX, point.x - radius);
    maxX = Math.max(maxX, point.x + radius);
    minY = Math.min(minY, point.y - radius);
    maxY = Math.max(maxY, point.y + radius);
  }
  const width = miniMap.width || 160;
  const height = miniMap.height || 160;
  const padding = 12;
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  return {
    width,
    height,
    padding,
    scale,
    centerX: (minX + maxX) * 0.5,
    centerY: (minY + maxY) * 0.5
  };
}

function mapToMini(x: number, y: number) {
  if (!miniMapConfig) return { x: 0, y: 0 };
  const { width, height, scale, centerX, centerY } = miniMapConfig;
  return {
    x: width * 0.5 + (x - centerX) * scale,
    y: height * 0.5 + (y - centerY) * scale
  };
}

function drawMiniMap(
  shipState: { position: { x: number; y: number }; visionRadius?: number },
  enemies: any[],
  allies: Array<{ ship: { position: { x: number; y: number } } }> = []
) {
  if (!miniMapCtx || !miniMapConfig) return;
  const { width, height, scale } = miniMapConfig;
  miniMapCtx.clearRect(0, 0, width, height);
  const bg = miniMapCtx.createRadialGradient(width * 0.5, height * 0.5, 10, width * 0.5, height * 0.5, width * 0.6);
  bg.addColorStop(0, 'rgba(12, 22, 44, 0.95)');
  bg.addColorStop(1, 'rgba(3, 8, 16, 0.95)');
  miniMapCtx.fillStyle = bg;
  miniMapCtx.fillRect(0, 0, width, height);

  miniMapCtx.save();
  miniMapCtx.strokeStyle = 'rgba(108, 246, 255, 0.16)';
  miniMapCtx.lineWidth = 1.2;
  miniMapCtx.shadowColor = 'rgba(108, 246, 255, 0.35)';
  miniMapCtx.shadowBlur = 6;
  cavePath.forEach((point) => {
    const radius = (point.radius ?? caveBaseRadius) * scale;
    const center = mapToMini(point.x, point.y);
    miniMapCtx.beginPath();
    miniMapCtx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    miniMapCtx.stroke();
  });
  miniMapCtx.restore();

  const pathGradient = miniMapCtx.createLinearGradient(0, 0, width, height);
  pathGradient.addColorStop(0, 'rgba(108, 246, 255, 0.75)');
  pathGradient.addColorStop(1, 'rgba(78, 190, 255, 0.35)');
  miniMapCtx.strokeStyle = pathGradient;
  miniMapCtx.lineWidth = 2.4;
  miniMapCtx.beginPath();
  cavePath.forEach((point, index) => {
    const mapped = mapToMini(point.x, point.y);
    if (index === 0) {
      miniMapCtx.moveTo(mapped.x, mapped.y);
    } else {
      miniMapCtx.lineTo(mapped.x, mapped.y);
    }
  });
  miniMapCtx.stroke();

  const shipPoint = mapToMini(shipState.position.x, shipState.position.y);
  miniMapCtx.fillStyle = '#6cf6ff';
  miniMapCtx.beginPath();
  miniMapCtx.arc(shipPoint.x, shipPoint.y, 3, 0, Math.PI * 2);
  miniMapCtx.fill();
  miniMapCtx.strokeStyle = 'rgba(108, 246, 255, 0.4)';
  miniMapCtx.lineWidth = 1.5;
  miniMapCtx.beginPath();
  miniMapCtx.arc(shipPoint.x, shipPoint.y, 6, 0, Math.PI * 2);
  miniMapCtx.stroke();
  if (allies.length) {
    miniMapCtx.fillStyle = 'rgba(124, 255, 214, 0.85)';
    allies.forEach(({ ship }) => {
      const allyPoint = mapToMini(ship.position.x, ship.position.y);
      miniMapCtx.beginPath();
      miniMapCtx.arc(allyPoint.x, allyPoint.y, 2.2, 0, Math.PI * 2);
      miniMapCtx.fill();
    });
  }

  const visionRadius = shipState.visionRadius ?? 160;
  const visionRadiusSq = visionRadius * visionRadius;
  for (const enemy of enemies) {
    if (!enemy || enemy.health <= 0) continue;
    const dx = enemy.position.x - shipState.position.x;
    const dy = enemy.position.y - shipState.position.y;
    const visible = dx * dx + dy * dy <= visionRadiusSq * 1.2;
    const color =
      enemy.kind === 'boss-warden' || enemy.kind === 'boss-siren' || enemy.kind === 'boss-behemoth'
        ? 'rgba(255, 90, 90, 0.9)'
        : enemy.kind === 'spitter'
          ? 'rgba(184, 123, 255, 0.9)'
          : enemy.kind === 'runner'
            ? 'rgba(255, 179, 71, 0.9)'
            : enemy.kind === 'lurker'
              ? 'rgba(88, 223, 255, 0.9)'
              : enemy.kind === 'brute'
                ? 'rgba(255, 124, 88, 0.9)'
                : enemy.kind === 'swarm'
                  ? 'rgba(255, 214, 92, 0.9)'
                  : 'rgba(255, 79, 79, 0.9)';
    const dot = mapToMini(enemy.position.x, enemy.position.y);
    miniMapCtx.fillStyle = visible ? color : 'rgba(120, 140, 170, 0.35)';
    miniMapCtx.beginPath();
    miniMapCtx.arc(dot.x, dot.y, visible ? 2.4 : 1.8, 0, Math.PI * 2);
    miniMapCtx.fill();
  }
}

const projectileGeometry = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8);
const projectileStyles: Record<
  string,
  {
    core: THREE.MeshStandardMaterial;
    glow: THREE.SpriteMaterial;
    scale: number;
    length: number;
    y: number;
  }
> = {
  mg: {
    core: new THREE.MeshStandardMaterial({
      color: 0x6cf6ff,
      roughness: 0.2,
      metalness: 0.2,
      emissive: 0x4bd7ff,
      emissiveIntensity: 0.6
    }),
    glow: new THREE.SpriteMaterial({ color: 0x7df9ff, opacity: 0.7, transparent: true }),
    scale: 1,
    length: 1.3,
    y: 0.55
  },
  cannon: {
    core: new THREE.MeshStandardMaterial({
      color: 0xffb347,
      roughness: 0.3,
      metalness: 0.1,
      emissive: 0xffc57a,
      emissiveIntensity: 0.5
    }),
    glow: new THREE.SpriteMaterial({ color: 0xffe2a3, opacity: 0.6, transparent: true }),
    scale: 1.1,
    length: 1.4,
    y: 0.65
  },
  rocket: {
    core: new THREE.MeshStandardMaterial({
      color: 0xff6b6b,
      roughness: 0.2,
      metalness: 0.2,
      emissive: 0xff8f8f,
      emissiveIntensity: 0.7
    }),
    glow: new THREE.SpriteMaterial({ color: 0xffb3b3, opacity: 0.75, transparent: true }),
    scale: 1.35,
    length: 1.8,
    y: 0.7
  },
  spit: {
    core: new THREE.MeshStandardMaterial({
      color: 0xb87bff,
      roughness: 0.4,
      metalness: 0.1,
      emissive: 0xd9b2ff,
      emissiveIntensity: 0.6
    }),
    glow: new THREE.SpriteMaterial({ color: 0xe6c7ff, opacity: 0.6, transparent: true }),
    scale: 1.15,
    length: 1.2,
    y: 0.6
  },
  plasma: {
    core: new THREE.MeshStandardMaterial({
      color: 0xff4fd4,
      roughness: 0.3,
      metalness: 0.1,
      emissive: 0xff88e0,
      emissiveIntensity: 0.6
    }),
    glow: new THREE.SpriteMaterial({ color: 0xffb1ee, opacity: 0.7, transparent: true }),
    scale: 1.1,
    length: 1.3,
    y: 0.65
  },
  boss: {
    core: new THREE.MeshStandardMaterial({
      color: 0xff3b3b,
      roughness: 0.2,
      metalness: 0.2,
      emissive: 0xff7a7a,
      emissiveIntensity: 0.7
    }),
    glow: new THREE.SpriteMaterial({ color: 0xffb3b3, opacity: 0.75, transparent: true }),
    scale: 1.5,
    length: 1.6,
    y: 0.75
  },
  piercer: {
    core: new THREE.MeshStandardMaterial({
      color: 0x6cffb4,
      roughness: 0.2,
      metalness: 0.2,
      emissive: 0x36f5a3,
      emissiveIntensity: 0.6
    }),
    glow: new THREE.SpriteMaterial({ color: 0x9dffd4, opacity: 0.7, transparent: true }),
    scale: 1.2,
    length: 1.7,
    y: 0.7
  },
  boomerang: {
    core: new THREE.MeshStandardMaterial({
      color: 0xffd166,
      roughness: 0.3,
      metalness: 0.2,
      emissive: 0xffc57a,
      emissiveIntensity: 0.6
    }),
    glow: new THREE.SpriteMaterial({ color: 0xffe2a3, opacity: 0.7, transparent: true }),
    scale: 1.1,
    length: 1.4,
    y: 0.65
  },
  arc: {
    core: new THREE.MeshStandardMaterial({
      color: 0x8ad4ff,
      roughness: 0.2,
      metalness: 0.2,
      emissive: 0x5bb8ff,
      emissiveIntensity: 0.6
    }),
    glow: new THREE.SpriteMaterial({ color: 0xbde7ff, opacity: 0.7, transparent: true }),
    scale: 1,
    length: 1.2,
    y: 0.6
  }
};
const projectileMeshes = new Map<string, THREE.Group>();
const projectilePool = new Map<string, THREE.Group[]>();
const sparkEffects: Array<{ sprite: THREE.Sprite; ttl: number; max: number }> = [];

function spawnSpark(x: number, z: number, color = 0xffd166, scale = 1.2) {
  const material = new THREE.SpriteMaterial({
    color,
    transparent: true,
    opacity: 1,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, 0.8, z);
  sprite.scale.set(scale, scale, scale);
  sprite.userData.baseScale = scale;
  scene.add(sprite);
  sparkEffects.push({ sprite, ttl: 0.6, max: 0.6 });
}

function triggerWeaponSfx(kind: string, timeNow: number) {
  if (kind === 'mg') {
    if (timeNow - sfxCooldowns.mg > 0.07) {
      playSfx('laser', { volume: 0.25, rate: 1 + Math.random() * 0.08 });
      sfxCooldowns.mg = timeNow;
    }
    return;
  }
  if (kind === 'cannon') {
    if (timeNow - sfxCooldowns.cannon > 0.2) {
      playSfx('cannon', { volume: 0.45, rate: 0.92 + Math.random() * 0.08 });
      sfxCooldowns.cannon = timeNow;
    }
    return;
  }
  if (kind === 'rocket') {
    if (timeNow - sfxCooldowns.rocket > 0.35) {
      playSfx('rocket', { volume: 0.45, rate: 0.85 + Math.random() * 0.1 });
      sfxCooldowns.rocket = timeNow;
    }
    return;
  }
  if (kind === 'piercer' || kind === 'arc') {
    if (timeNow - sfxCooldowns.mg > 0.12) {
      playSfx('laser', { volume: 0.28, rate: 0.9 + Math.random() * 0.1 });
      sfxCooldowns.mg = timeNow;
    }
    return;
  }
  if (kind === 'boomerang') {
    if (timeNow - sfxCooldowns.cannon > 0.22) {
      playSfx('cannon', { volume: 0.35, rate: 1.1 + Math.random() * 0.08 });
      sfxCooldowns.cannon = timeNow;
    }
  }
}

function normalizeModel(object: THREE.Object3D, targetSize: number) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / maxDim;
  object.scale.setScalar(scale);
  object.position.sub(center.multiplyScalar(scale));
  object.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(object);
  object.position.y -= scaledBox.min.y;
}

function loadModel(name: string, modelFile: string, targetSize: number) {
  return new Promise<THREE.Object3D | null>((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      modelFile,
      (gltf) => {
        const model = gltf.scene;
        normalizeModel(model, targetSize);
        resolve(model);
      },
      undefined,
      (error) => {
        addLog('error', `Asset load failed: ${name}`, error);
        resolve(null);
      }
    );
  });
}

async function loadModelSafe(name: string, modelFile: string, targetSize: number) {
  try {
    return await loadModel(name, modelFile, targetSize);
  } catch (error) {
    addLog('error', `Asset load failed: ${name}`, error);
    return null;
  }
}

async function loadAnimatedModelSafe(name: string, modelFile: string, targetSize: number) {
  try {
    const gltf = await new GLTFLoader().loadAsync(modelFile);
    const model = gltf.scene;
    normalizeModel(model, targetSize);
    return { model, animations: gltf.animations ?? [] } as AnimatedTemplate;
  } catch (error) {
    addLog('error', `Asset load failed: ${name}`, error);
    return null;
  }
}

const systemAbilityLabels = ['EMP', 'Shield Burst', 'Slow Field', 'Overdrive'];

function getSeatInput(seat: SeatType) {
  const inputs = (state.room?.state as { seatInputs?: { get?: (key: SeatType) => any } } | null)?.seatInputs;
  if (!inputs?.get) return null;
  return inputs.get(seat);
}

function getRoomMode() {
  const mode = (state.room?.state as { mode?: GameMode } | null)?.mode;
  return mode ?? state.mode;
}

function isSoloControlMode() {
  const mode = getRoomMode();
  return mode === 'single' || mode === 'solo';
}

function getRoomShips() {
  return (state.room?.state as { ships?: { get?: (key: string) => any; forEach?: (cb: (ship: any, id: string) => void) => void } } | null)?.ships;
}

function getLocalShipState() {
  const mode = getRoomMode();
  if (mode === 'solo') {
    const ships = getRoomShips();
    if (!ships?.get || !state.playerId) return null;
    return ships.get(state.playerId) ?? null;
  }
  return (state.room?.state as { ship?: any } | null)?.ship ?? null;
}

function getRemoteShipStates() {
  const mode = getRoomMode();
  if (mode !== 'solo') return [];
  const ships = getRoomShips();
  if (!ships?.forEach) return [];
  const remotes: Array<{ id: string; ship: any }> = [];
  ships.forEach((ship: any, id: string) => {
    if (id === state.playerId) return;
    remotes.push({ id, ship });
  });
  return remotes;
}

function safeVector2(value: any, fallback: { x: number; y: number }) {
  if (!value || typeof value.x !== 'number' || typeof value.y !== 'number') return fallback;
  return { x: value.x, y: value.y };
}

function updateSeatPanels() {
  if (!state.room) return;
  if (getRoomMode() === 'solo') {
    const players = state.room.state.players;
    const humanIds: string[] = [];
    players.forEach((player) => {
      if (!player.isBot && player.connected) humanIds.push(player.id.slice(0, 4));
    });
    const label = humanIds.length ? `SOLO ${humanIds.length}` : 'SOLO';
    pilotSeatLabel.textContent = label;
    gunnerSeatLabel.textContent = '-';
    powerSeatLabel.textContent = '-';
    systemsSeatLabel.textContent = '-';
    supportSeatLabel.textContent = '-';
    crewPilotTag.textContent = label;
    crewGunnerTag.textContent = '-';
    crewPowerTag.textContent = '-';
    crewSystemsTag.textContent = '-';
    crewSupportTag.textContent = '-';
    return;
  }
  const seatToLabel = new Map<SeatType, string>();
  state.room.state.players.forEach((player) => {
    const label = player.isBot ? 'BOT' : player.id.slice(0, 4);
    seatToLabel.set(player.seat, label);
  });
  pilotSeatLabel.textContent = seatToLabel.get('pilot') ?? '-';
  gunnerSeatLabel.textContent = seatToLabel.get('gunner') ?? '-';
  powerSeatLabel.textContent = seatToLabel.get('power') ?? '-';
  systemsSeatLabel.textContent = seatToLabel.get('systems') ?? '-';
  supportSeatLabel.textContent = seatToLabel.get('support') ?? '-';
  crewPilotTag.textContent = seatToLabel.get('pilot') ?? '-';
  crewGunnerTag.textContent = seatToLabel.get('gunner') ?? '-';
  crewPowerTag.textContent = seatToLabel.get('power') ?? '-';
  crewSystemsTag.textContent = seatToLabel.get('systems') ?? '-';
  crewSupportTag.textContent = seatToLabel.get('support') ?? '-';
}

function applyPowerupModel(index: number, model: THREE.Object3D) {
  powerupTemplates[index] = model;
  const target = powerups[index];
  if (!target) return;
  target.clear();
  target.add(model.clone());
}

function acquireEnemyMesh(kind: EnemyKind, template?: AnimatedTemplate) {
  const pool = enemyPool.get(kind) ?? [];
  let mesh = pool.pop();
  if (!mesh) {
    if (template) {
      mesh = template.animations.length ? SkeletonUtils.clone(template.model) : template.model.clone(true);
      if (template.animations.length) {
        mesh.userData.animations = template.animations;
      }
    } else {
      const material = enemyMaterials[kind] ?? enemyMaterials.chaser;
      mesh = new THREE.Mesh(enemyGeometry, material);
    }
    mesh.userData.baseScale = mesh.scale.clone();
    scene.add(mesh);
  }
  mesh.visible = true;
  mesh.userData.kind = kind;
  return mesh;
}

function releaseEnemyMesh(mesh: THREE.Object3D) {
  const kind = (mesh.userData.kind as EnemyKind) ?? 'chaser';
  mesh.visible = false;
  mesh.position.set(9999, -9999, 9999);
  const pool = enemyPool.get(kind) ?? [];
  pool.push(mesh);
  enemyPool.set(kind, pool);
  // mixer removed by enemy id on release
}

function acquireProjectile(kind: string) {
  const pool = projectilePool.get(kind) ?? [];
  let group = pool.pop();
  if (!group) {
    const style = projectileStyles[kind] ?? projectileStyles.mg;
    group = new THREE.Group();
    const core = new THREE.Mesh(projectileGeometry, style.core);
    core.rotation.x = Math.PI / 2;
    const glow = new THREE.Sprite(style.glow.clone());
    const lengthScale = style.length / 1.6;
    core.scale.set(style.scale, style.scale * lengthScale, style.scale);
    glow.scale.set(1.2 * style.scale, 1.2 * style.scale, 1);
    glow.position.set(0, 0, -0.5);
    group.add(core);
    group.add(glow);
    group.userData.core = core;
    group.userData.glow = glow;
    group.userData.kind = kind;
    scene.add(group);
  } else {
    group.visible = true;
    group.userData.kind = kind;
  }
  return group;
}

function releaseProjectile(group: THREE.Group) {
  const kind = (group.userData.kind as string) ?? 'mg';
  group.visible = false;
  group.position.set(9999, -9999, 9999);
  const pool = projectilePool.get(kind) ?? [];
  pool.push(group);
  projectilePool.set(kind, pool);
}

function registerProp(name: string, model: THREE.Object3D, kind: 'rock' | 'prop') {
  propTemplates.set(name, model);
  if (kind === 'rock') {
    rockTemplates.push(model);
  }
  buildCaveEnvironment();
}

function buildCaveEnvironment() {
  if (caveBuilt || rockTemplates.length < 3) return;
  caveBuilt = true;
  const rng = mulberry32(4919);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x101520, roughness: 0.95, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  caveGroup.add(floor);

  for (let i = 0; i < cavePath.length - 1; i += 1) {
    const a = cavePath[i];
    const b = cavePath[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len = Math.hypot(vx, vy) || 1;
    const steps = Math.max(4, Math.floor(len / 10));
    const nx = -vy / len;
    const ny = vx / len;
    const r0 = a.radius ?? caveBaseRadius;
    const r1 = b.radius ?? caveBaseRadius;
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const cx = a.x + vx * t;
      const cy = a.y + vy * t;
      const radius = r0 + (r1 - r0) * t;
      for (const side of [-1, 1]) {
        const wallOffset = radius + 6 + rng() * 8;
        const px = cx + nx * wallOffset * side;
        const py = cy + ny * wallOffset * side;
        const template = rockTemplates[Math.floor(rng() * rockTemplates.length)];
        const rock = template.clone(true);
        const baseScale = 0.9 + rng() * 1.4;
        rock.position.set(px, 0, py);
        rock.rotation.y = rng() * Math.PI * 2;
        rock.rotation.x = (rng() - 0.5) * 0.4;
        rock.scale.multiplyScalar(baseScale);
        caveGroup.add(rock);
      }
      if (rng() > 0.82 && propTemplates.size > 0) {
        const propList = Array.from(propTemplates.values());
        const prop = propList[Math.floor(rng() * propList.length)].clone(true);
        const offset = rng() * radius * 0.5;
        prop.position.set(cx + nx * offset, 0, cy + ny * offset);
        prop.rotation.y = rng() * Math.PI * 2;
        prop.scale.multiplyScalar(0.8 + rng() * 0.8);
        caveGroup.add(prop);
      }
    }
  }
}

function buildCaveFallback() {
  if (caveBuilt || caveFallbackBuilt) return;
  caveFallbackBuilt = true;
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.9, metalness: 0.05 });
  const rockGeo = new THREE.IcosahedronGeometry(3.2, 0);
  for (let i = 0; i < cavePath.length - 1; i += 1) {
    const a = cavePath[i];
    const b = cavePath[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len = Math.hypot(vx, vy) || 1;
    const steps = Math.max(4, Math.floor(len / 12));
    const nx = -vy / len;
    const ny = vx / len;
    const r0 = a.radius ?? caveBaseRadius;
    const r1 = b.radius ?? caveBaseRadius;
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const cx = a.x + vx * t;
      const cy = a.y + vy * t;
      const radius = r0 + (r1 - r0) * t;
      for (const side of [-1, 1]) {
        const wallOffset = radius + 5;
        const px = cx + nx * wallOffset * side;
        const py = cy + ny * wallOffset * side;
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(px, 0, py);
        rock.rotation.y = Math.random() * Math.PI * 2;
        caveGroup.add(rock);
      }
    }
  }
}

if (!e2eStaticScene) {
  void loadModelSafe('ship', `${assetBase}/Vehicles/Spaceship_FinnTheFrog.gltf`, 4.2).then((model) => {
    if (!model) return;
    ship.clear();
    ship.add(model);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    thrusters.position.set(0, size.y * 0.25, box.min.z - size.z * 0.08);
    thrusters.scale.setScalar(Math.max(size.x, size.z) / 4);
    thrusters.userData.baseScale = thrusters.scale.clone();
    ship.add(thrusters);
  });

  void loadAnimatedModelSafe('enemy-chaser', `${assetBase}/Characters/Enemy_Small.gltf`, 2.1).then((model) => {
    if (!model) return;
    enemyTemplates.chaser = model;
  });

  void loadAnimatedModelSafe('enemy-runner', `${assetBase}/Characters/Enemy_ExtraSmall.gltf`, 1.9).then((model) => {
    if (!model) return;
    enemyTemplates.runner = model;
  });

  void loadAnimatedModelSafe('enemy-spitter', `${assetBase}/Characters/Enemy_Flying.gltf`, 2.4).then((model) => {
    if (!model) return;
    enemyTemplates.spitter = model;
  });

  void loadAnimatedModelSafe('enemy-boss', `${assetBase}/Characters/Enemy_Large.gltf`, 4.8).then((model) => {
    if (!model) return;
    enemyTemplates['boss-warden'] = model;
    enemyTemplates['boss-siren'] = model;
    enemyTemplates['boss-behemoth'] = model;
  });

  void loadModelSafe('powerup-health', `${assetBase}/Items/Pickup_Health.gltf`, 1.8).then((model) => {
    if (!model) return;
    applyPowerupModel(0, model);
  });

  void loadModelSafe('powerup-thunder', `${assetBase}/Items/Pickup_Thunder.gltf`, 1.8).then((model) => {
    if (!model) return;
    applyPowerupModel(1, model);
  });

  const envPropSources = [
    { name: 'rock-1', path: `${assetBase}/Environment/Rock_1.gltf`, size: 6, kind: 'rock' as const },
    { name: 'rock-2', path: `${assetBase}/Environment/Rock_2.gltf`, size: 6, kind: 'rock' as const },
    { name: 'rock-3', path: `${assetBase}/Environment/Rock_3.gltf`, size: 6, kind: 'rock' as const },
    { name: 'rock-4', path: `${assetBase}/Environment/Rock_4.gltf`, size: 6, kind: 'rock' as const },
    { name: 'rock-large-1', path: `${assetBase}/Environment/Rock_Large_1.gltf`, size: 11, kind: 'rock' as const },
    { name: 'rock-large-2', path: `${assetBase}/Environment/Rock_Large_2.gltf`, size: 11, kind: 'rock' as const },
    { name: 'rock-large-3', path: `${assetBase}/Environment/Rock_Large_3.gltf`, size: 11, kind: 'rock' as const },
    { name: 'metal-support', path: `${assetBase}/Environment/MetalSupport.gltf`, size: 7, kind: 'prop' as const },
    { name: 'solar-panel', path: `${assetBase}/Environment/SolarPanel_Ground.gltf`, size: 7, kind: 'prop' as const },
    { name: 'solar-panel-roof', path: `${assetBase}/Environment/SolarPanel_Roof.gltf`, size: 8, kind: 'prop' as const },
    { name: 'solar-panel-structure', path: `${assetBase}/Environment/SolarPanel_Structure.gltf`, size: 9, kind: 'prop' as const },
    { name: 'geodesic', path: `${assetBase}/Environment/GeodesicDome.gltf`, size: 10, kind: 'prop' as const },
    { name: 'house-single', path: `${assetBase}/Environment/House_Single.gltf`, size: 9, kind: 'prop' as const },
    { name: 'house-long', path: `${assetBase}/Environment/House_Long.gltf`, size: 11, kind: 'prop' as const },
    { name: 'house-open', path: `${assetBase}/Environment/House_Open.gltf`, size: 9, kind: 'prop' as const },
    { name: 'house-open-back', path: `${assetBase}/Environment/House_OpenBack.gltf`, size: 9, kind: 'prop' as const },
    { name: 'house-cylinder', path: `${assetBase}/Environment/House_Cylinder.gltf`, size: 10, kind: 'prop' as const },
    { name: 'connector', path: `${assetBase}/Environment/Connector.gltf`, size: 8, kind: 'prop' as const },
    { name: 'base-large', path: `${assetBase}/Environment/Base_Large.gltf`, size: 14, kind: 'prop' as const },
    { name: 'building-l', path: `${assetBase}/Environment/Building_L.gltf`, size: 14, kind: 'prop' as const },
    { name: 'roof-radar', path: `${assetBase}/Environment/Roof_Radar.gltf`, size: 7, kind: 'prop' as const },
    { name: 'roof-antenna', path: `${assetBase}/Environment/Roof_Antenna.gltf`, size: 6, kind: 'prop' as const },
    { name: 'roof-opening', path: `${assetBase}/Environment/Roof_Opening.gltf`, size: 6, kind: 'prop' as const },
    { name: 'tree-lava-1', path: `${assetBase}/Environment/Tree_Lava_1.gltf`, size: 7, kind: 'prop' as const },
    { name: 'tree-lava-2', path: `${assetBase}/Environment/Tree_Lava_2.gltf`, size: 7, kind: 'prop' as const },
    { name: 'tree-lava-3', path: `${assetBase}/Environment/Tree_Lava_3.gltf`, size: 8, kind: 'prop' as const },
    { name: 'tree-spiral-1', path: `${assetBase}/Environment/Tree_Spiral_1.gltf`, size: 7, kind: 'prop' as const },
    { name: 'tree-spiral-2', path: `${assetBase}/Environment/Tree_Spiral_2.gltf`, size: 7, kind: 'prop' as const },
    { name: 'tree-spiral-3', path: `${assetBase}/Environment/Tree_Spiral_3.gltf`, size: 7, kind: 'prop' as const },
    { name: 'tree-swirl-1', path: `${assetBase}/Environment/Tree_Swirl_1.gltf`, size: 7, kind: 'prop' as const },
    { name: 'tree-swirl-2', path: `${assetBase}/Environment/Tree_Swirl_2.gltf`, size: 7, kind: 'prop' as const },
    { name: 'tree-blob-1', path: `${assetBase}/Environment/Tree_Blob_1.gltf`, size: 6, kind: 'prop' as const },
    { name: 'tree-blob-2', path: `${assetBase}/Environment/Tree_Blob_2.gltf`, size: 6, kind: 'prop' as const },
    { name: 'tree-blob-3', path: `${assetBase}/Environment/Tree_Blob_3.gltf`, size: 6, kind: 'prop' as const },
    { name: 'tree-spikes-1', path: `${assetBase}/Environment/Tree_Spikes_1.gltf`, size: 6, kind: 'prop' as const },
    { name: 'tree-spikes-2', path: `${assetBase}/Environment/Tree_Spikes_2.gltf`, size: 6, kind: 'prop' as const },
    { name: 'tree-floating-1', path: `${assetBase}/Environment/Tree_Floating_1.gltf`, size: 6, kind: 'prop' as const },
    { name: 'tree-floating-2', path: `${assetBase}/Environment/Tree_Floating_2.gltf`, size: 6, kind: 'prop' as const },
    { name: 'tree-floating-3', path: `${assetBase}/Environment/Tree_Floating_3.gltf`, size: 6, kind: 'prop' as const },
    { name: 'tree-light-1', path: `${assetBase}/Environment/Tree_Light_1.gltf`, size: 6, kind: 'prop' as const },
    { name: 'tree-light-2', path: `${assetBase}/Environment/Tree_Light_2.gltf`, size: 6, kind: 'prop' as const },
    { name: 'plant-1', path: `${assetBase}/Environment/Plant_1.gltf`, size: 4, kind: 'prop' as const },
    { name: 'plant-2', path: `${assetBase}/Environment/Plant_2.gltf`, size: 4, kind: 'prop' as const },
    { name: 'plant-3', path: `${assetBase}/Environment/Plant_3.gltf`, size: 4, kind: 'prop' as const },
    { name: 'bush-1', path: `${assetBase}/Environment/Bush_1.gltf`, size: 4, kind: 'prop' as const },
    { name: 'bush-2', path: `${assetBase}/Environment/Bush_2.gltf`, size: 4, kind: 'prop' as const },
    { name: 'bush-3', path: `${assetBase}/Environment/Bush_3.gltf`, size: 4, kind: 'prop' as const },
    { name: 'grass-1', path: `${assetBase}/Environment/Grass_1.gltf`, size: 3, kind: 'prop' as const },
    { name: 'grass-2', path: `${assetBase}/Environment/Grass_2.gltf`, size: 3, kind: 'prop' as const },
    { name: 'grass-3', path: `${assetBase}/Environment/Grass_3.gltf`, size: 3, kind: 'prop' as const },
    { name: 'ramp', path: `${assetBase}/Environment/Ramp.gltf`, size: 8, kind: 'prop' as const },
    { name: 'stairs', path: `${assetBase}/Environment/Stairs.gltf`, size: 8, kind: 'prop' as const }
  ];

  envPropSources.forEach((entry) => {
    void loadModelSafe(entry.name, entry.path, entry.size).then((model) => {
      if (!model) return;
      registerProp(entry.name, model, entry.kind);
    });
  });
}

if (!e2eStaticScene) {
  setTimeout(() => {
    buildCaveFallback();
  }, 1500);
}

if (!e2eStaticScene) {
  void loadModelSafe('planet', `${assetBase}/Environment/Planet_7.gltf`, 120).then((model) => {
    if (!model) return;
    model.position.set(-140, 60, -220);
    scene.add(model);
  });
}

const shipHeading = new THREE.Vector3(0, 0, 1);
const shipPosition = new THREE.Vector3(0, 0, 0);
const renderShipPosition = new THREE.Vector3(0, 0, 0);
const renderShipVelocity = new THREE.Vector3(0, 0, 0);
let headingYaw = 0;
const lastServerPosition = new THREE.Vector3(0, 0, 0);
let renderInitialized = false;
let lastServerUpdate = performance.now();
const shipTuning = {
  accelBase: 18,
  accelBonus: 30,
  speed: 55,
  speedBoost: 80,
  damping: 0.92,
  velocitySmoothing: 6,
  positionSmoothing: 8,
  inputImpulse: 0.12
};
let fps = 0;
let frameCount = 0;
let lastFpsAt = performance.now();
let serverTickHz = 0;
let lastStateAt = 0;
const gamepadState = {
  lb: false,
  rb: false
};
let gunnerHeat = 0;
let lastSpeed = 0;
let lastRepairCooldown = 0;
let lastTrailAt = 0;
const projectileAudioCache = new Map<string, { kind: string; owner?: string; x: number; y: number }>();
const sfxCooldowns = {
  mg: 0,
  cannon: 0,
  rocket: 0,
  explosion: 0
};
const sfxState = {
  lastBoost: false,
  lastPingCooldown: 0,
  lastRepairCooldown: 0,
  lastEmpCooldown: 0,
  lastShieldCooldown: 0,
  lastSlowCooldown: 0,
  lastOverdriveCooldown: 0
};
type E2EState = {
  ship: {
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    energyEngines: number;
    energyWeapons?: number;
    energyShields?: number;
    visionRadius: number;
    powerInstability?: number;
    powerHeat?: number;
    powerWindowStart?: number;
    powerWindowEnd?: number;
    powerOverloadUntil?: number;
    powerPerfectUntil?: number;
    visionPulseUntil?: number;
  };
  enemies: Array<{
    id: string;
    kind: EnemyKind;
    position: { x: number; y: number };
    velocity?: { x: number; y: number };
    health: number;
    yaw?: number;
    markedUntil?: number;
    exposedUntil?: number;
    volatileUntil?: number;
    trackingUntil?: number;
    weakpointUntil?: number;
    telegraphUntil?: number;
  }>;
  projectiles: Array<{
    id: string;
    kind: string;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
  }>;
  time: number;
  wave: number;
};
let e2eState: E2EState | null = null;
const e2eStatus = e2eVisualsEnabled ? { ready: false } : null;
if (e2eStatus) {
  (window as unknown as { __htownE2E?: { ready: boolean } }).__htownE2E = e2eStatus;
  const fallbackDelay = e2eScene === 'cave' ? 6000 : 1500;
  window.setTimeout(() => {
    if (!e2eStatus.ready) {
      e2eStatus.ready = true;
    }
  }, fallbackDelay);
}

function resizeRenderer() {
  const { clientWidth, clientHeight } = arena;
  if (!clientWidth || !clientHeight) return;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resizeRenderer);
resizeRenderer();

function initE2EState() {
  if (!e2eVisualsEnabled) return;
  const ship = {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    energyEngines: 1,
    visionRadius: 220
  };
  if (e2eScene === 'projectiles') {
    e2eState = {
      ship,
      time: 12,
      wave: 1,
      enemies: [
        { id: 'e2e-chaser', kind: 'chaser', position: { x: 6, y: 14 }, health: 20, yaw: 0.6 },
        { id: 'e2e-runner', kind: 'runner', position: { x: -8, y: 12 }, health: 16, yaw: -0.3 },
        { id: 'e2e-spitter', kind: 'spitter', position: { x: 4, y: 18 }, health: 18, yaw: 0.9 }
      ],
      projectiles: [
        { id: 'e2e-mg', kind: 'mg', position: { x: -1.5, y: 6.5 }, velocity: { x: 0, y: 1 } },
        { id: 'e2e-cannon', kind: 'cannon', position: { x: 0.6, y: 8 }, velocity: { x: 0.1, y: 1 } },
        { id: 'e2e-rocket', kind: 'rocket', position: { x: 2.2, y: 9.5 }, velocity: { x: -0.1, y: 1 } },
        { id: 'e2e-spit', kind: 'spit', position: { x: -3, y: 11.8 }, velocity: { x: 0.05, y: -1 } }
      ]
    };
  } else if (e2eScene === 'wave') {
    const time = 120;
    e2eState = {
      ship,
      time,
      wave: 5,
      enemies: [
        {
          id: 'e2e-boss',
          kind: 'boss-warden',
          position: { x: 0, y: 22 },
          health: 320,
          yaw: Math.PI,
          telegraphUntil: time + 90
        },
        {
          id: 'e2e-spitter',
          kind: 'spitter',
          position: { x: 11, y: 16 },
          health: 22,
          yaw: -0.8,
          markedUntil: time + 90
        },
        { id: 'e2e-runner', kind: 'runner', position: { x: -12, y: 14 }, health: 14, yaw: 0.4 },
        { id: 'e2e-chaser', kind: 'chaser', position: { x: 7, y: 10 }, health: 18, yaw: -0.4 }
      ],
      projectiles: [
        { id: 'e2e-boss-shot', kind: 'boss', position: { x: -2, y: 13 }, velocity: { x: 0.05, y: -1 } },
        { id: 'e2e-plasma', kind: 'plasma', position: { x: 2.4, y: 12.2 }, velocity: { x: -0.05, y: -1 } }
      ]
    };
  } else if (e2eScene === 'telegraph') {
    const time = 240;
    e2eState = {
      ship: { ...ship, visionRadius: 260 },
      time,
      wave: 7,
      enemies: [
        {
          id: 'e2e-boss',
          kind: 'boss-warden',
          position: { x: 0, y: 26 },
          health: 360,
          yaw: Math.PI,
          telegraphUntil: time + 90
        },
        {
          id: 'e2e-marked',
          kind: 'spitter',
          position: { x: 14, y: 18 },
          health: 22,
          yaw: -0.6,
          markedUntil: time + 90
        },
        { id: 'e2e-runner', kind: 'runner', position: { x: -14, y: 14 }, health: 14, yaw: 0.4 },
        { id: 'e2e-chaser', kind: 'chaser', position: { x: 9, y: 10 }, health: 18, yaw: -0.4 }
      ],
      projectiles: [
        { id: 'e2e-boss-shot', kind: 'boss', position: { x: -2, y: 15 }, velocity: { x: 0.05, y: -1 } },
        { id: 'e2e-plasma', kind: 'plasma', position: { x: 2.4, y: 14.2 }, velocity: { x: -0.05, y: -1 } }
      ]
    };
  } else if (e2eScene === 'cave') {
    const anchor = cavePath[Math.min(4, cavePath.length - 1)];
    e2eState = {
      ship: { ...ship, position: { x: anchor.x, y: anchor.y }, visionRadius: 320 },
      time: 45,
      wave: 2,
      enemies: [],
      projectiles: []
    };
  } else if (e2eScene === 'summary') {
    showGameover({
      score: 1820,
      wave: 6,
      time: 312,
      kills: 42,
      bossKills: 1,
      seatStats: {
        pilot: { distance: 680, boosts: 6, handbrakes: 2 },
        gunner: { shots: 210, hits: 74, kills: 28 },
        power: { presets: 5, sliders: 8 },
        systems: { uses: 6 },
        support: { scans: 4, repairs: 3, loots: 2 }
      }
    });
  }

  if (e2eState) {
    const waveLabel = document.getElementById('wave');
    if (waveLabel) waveLabel.textContent = `Wave ${e2eState.wave}`;
    const scoreLabel = document.getElementById('score');
    if (scoreLabel) scoreLabel.textContent = `Score ${Math.round(e2eState.wave * 120)}`;
  }
}

initE2EState();

function updateScene(dt: number) {
  applyGamepadInputs();
  resolveLocalSeat();
  updateSeatPanels();
  const shipState = e2eState?.ship ?? getLocalShipState();
  const enemySource = e2eState?.enemies ?? state.room?.state?.enemies;
  const projectileSource = e2eState?.projectiles ?? state.room?.state?.projectiles;
  const sceneTime = e2eState?.time ?? state.room?.state?.timeSurvived ?? 0;
  const remoteShips = e2eState ? [] : getRemoteShipStates();
  const pilotInput = getSeatInput('pilot');
  const gunnerInput = getSeatInput('gunner');
  const powerInput = getSeatInput('power');
  const systemsInput = getSeatInput('systems');
  const supportInput = getSeatInput('support');
  const roomPhase = (state.room?.state as { phase?: string } | null)?.phase ?? 'running';
  const isRunning = roomPhase === 'running';
  const radarActive = e2eRadarActive || ((state.room?.state?.support?.radarUntil ?? 0) > 0);

  const pilotMove =
    isRunning
      ? state.seat === 'pilot'
        ? pilotAxis
        : safeVector2(pilotInput?.move, { x: 0, y: 0 })
      : { x: 0, y: 0 };
  const pilotLift = isRunning
    ? state.seat === 'pilot'
      ? pilotLiftAxis
      : typeof pilotInput?.lift === 'number'
        ? pilotInput.lift
        : 0
    : 0;
  const pilotBoostActive = isRunning
    ? state.seat === 'pilot'
      ? pilotBoost.dataset.active === 'true'
      : Boolean(pilotInput?.boost)
    : false;
  const gunnerAim =
    isRunning
      ? state.seat === 'gunner' || isSoloControlMode()
        ? gunnerAxis
        : safeVector2(gunnerInput?.aim, { x: 1, y: 0 })
      : { x: 1, y: 0 };
  const gunnerFiring = isRunning ? Boolean(gunnerInput?.fire) : false;

  if (pilotBoostActive && !sfxState.lastBoost) {
    playSfx('boost', { volume: 0.5, rate: 1.1 });
  }
  sfxState.lastBoost = pilotBoostActive;

  if (state.seat === 'pilot') {
    arenaDebug.textContent = `Pilot: ${pilotMove.x.toFixed(2)}, ${pilotMove.y.toFixed(2)} L${pilotLift.toFixed(2)}${pilotBoostActive ? ' BOOST' : ''}`;
  } else if (state.seat === 'gunner') {
    arenaDebug.textContent = `Gunner: ${gunnerAim.x.toFixed(2)}, ${gunnerAim.y.toFixed(2)}${localActions.gunner.fire ? ' FIRE' : ''}`;
  } else {
    arenaDebug.textContent = `Seat: ${state.seat.toUpperCase()}`;
  }

  if (shipState) {
    const now = performance.now();
    shipPosition.set(shipState.position.x, shipState.position.z ?? 0, shipState.position.y);
    if (!renderInitialized) {
      renderInitialized = true;
      renderShipPosition.copy(shipPosition);
      renderShipVelocity.set(0, 0, 0);
      lastServerPosition.copy(shipPosition);
      lastServerUpdate = now;
    }
    if (shipPosition.distanceToSquared(lastServerPosition) > 0.0001) {
      lastServerPosition.copy(shipPosition);
      lastServerUpdate = now;
    }

    const accel = shipTuning.accelBase + shipState.energyEngines * shipTuning.accelBonus;
    const speedLimit = pilotBoostActive ? shipTuning.speedBoost : shipTuning.speed;
    const serverVelocity = new THREE.Vector3(
      shipState.velocity.x,
      shipState.velocity.z ?? 0,
      shipState.velocity.y
    );
    const serverSpeed = serverVelocity.length();
    if (serverSpeed > speedLimit) {
      serverVelocity.multiplyScalar(speedLimit / serverSpeed);
    }
    const inputActive = Math.hypot(pilotMove.x, pilotMove.y) > 0.01 || Math.abs(pilotLift) > 0.05;
    const inputImpulse = inputActive
      ? new THREE.Vector3(pilotMove.x, pilotLift * 0.6, pilotMove.y).multiplyScalar(
          accel * dt * shipTuning.inputImpulse
        )
      : new THREE.Vector3();
    const velocityBlend = 1 - Math.exp(-shipTuning.velocitySmoothing * dt);
    renderShipVelocity.lerp(serverVelocity, velocityBlend);
    renderShipVelocity.add(inputImpulse);
    const speed = renderShipVelocity.length();
    lastSpeed = speed;
    if (speed > speedLimit) {
      renderShipVelocity.multiplyScalar(speedLimit / speed);
    }
    const speedPct = Math.min(speed / speedLimit, 1);
    speedbarFill.style.transform = `scaleX(${speedPct})`;
    speedbarLabel.textContent = `SPD ${Math.round(speed)}`;
    if (audioState.unlocked) {
      if (!audioState.loops.has('engine')) startLoop('engine', 0.18);
      setLoopVolume('engine', 0.18 + speedPct * 0.35);
    }
    const thrust = speedPct;
    thrusterMaterial.opacity = Math.min(1, 0.2 + thrust * 0.7 + (pilotBoostActive ? 0.2 : 0));
    const baseScale = (thrusters.userData.baseScale as THREE.Vector3) ?? new THREE.Vector3(1, 1, 1);
    thrusters.scale.set(
      baseScale.x,
      baseScale.y,
      baseScale.z * (0.6 + thrust * 1.2 + (pilotBoostActive ? 0.4 : 0))
    );
    renderShipPosition.addScaledVector(renderShipVelocity, dt);
    renderShipVelocity.multiplyScalar(shipTuning.damping);

    const snap = inputActive ? 1 - Math.exp(-shipTuning.positionSmoothing * dt) : 0.2;
    renderShipPosition.lerp(shipPosition, snap);
    ship.position.copy(renderShipPosition);
    const comboTrailActive = (shipState.comboTrailUntil ?? 0) > sceneTime;
    if (comboTrailActive && sceneTime - lastTrailAt > 0.06) {
      const offset = shipHeading.clone().multiplyScalar(-2.2);
      spawnSpark(ship.position.x + offset.x, ship.position.z + offset.z, 0x6cf6ff, 1.4);
      lastTrailAt = sceneTime;
    }
    const visionRadius = shipState.visionRadius ?? 160;
    if (visionMask) {
      const minDim = Math.min(arena.clientWidth, arena.clientHeight) || 1;
      const pulseActive = (shipState.visionPulseUntil ?? 0) > sceneTime;
      const pulseBoost = pulseActive ? 1.2 : 1;
      const radiusPx = Math.max(140, Math.min(minDim * 0.48, visionRadius * 1.8 * pulseBoost));
      const dark = radarActive ? 0.6 : pulseActive ? 0.7 : 0.85;
      const mid = radarActive ? 0.18 : pulseActive ? 0.2 : 0.25;
      visionMask.style.background = `radial-gradient(circle ${radiusPx}px at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,${mid}) 55%, rgba(0,0,0,${dark}) 100%)`;
    }
    if (shipGlow) {
      shipGlow.intensity = radarActive ? 1.1 : 0.6;
    }

    const moveLen = Math.hypot(pilotMove.x, pilotMove.y);
    let desiredYaw = headingYaw;
    if (moveLen > 0.05) {
      desiredYaw = Math.atan2(pilotMove.x, pilotMove.y);
    } else if (speed > 0.5) {
      desiredYaw = Math.atan2(renderShipVelocity.x, renderShipVelocity.z);
    } else if (serverSpeed > 0.5) {
      desiredYaw = Math.atan2(shipState.velocity.x, shipState.velocity.y);
    }
    headingYaw = lerpAngle(headingYaw, desiredYaw, 1 - Math.exp(-6 * dt));
    shipHeading.set(Math.sin(headingYaw), 0, Math.cos(headingYaw));
    ship.rotation.y = headingYaw;
    ship.rotation.z = -pilotMove.x * 0.35;
    ship.rotation.x = -pilotMove.y * 0.15;

    cameraState.distance += (cameraState.targetDistance - cameraState.distance) * Math.min(1, dt * 4);
    const camYaw = headingYaw + cameraState.yawOffset + Math.PI;
    const camPitch = cameraState.pitchOffset;
    const camDir = new THREE.Vector3(
      Math.sin(camYaw) * Math.cos(camPitch),
      Math.sin(camPitch),
      Math.cos(camYaw) * Math.cos(camPitch)
    );
    desiredCameraPos.copy(renderShipPosition).addScaledVector(camDir, cameraState.distance);
    desiredCameraPos.y += cameraState.height;
    const collision = resolveCameraCollision(renderShipPosition, desiredCameraPos);
    cameraState.collision = collision.collided;
    const smoothing = 1 - Math.exp(-cameraState.smoothing * dt);
    camera.position.lerp(collision.position, smoothing);
    cameraTarget.copy(renderShipPosition).addScaledVector(shipHeading, cameraState.lookAhead).add(new THREE.Vector3(0, 1, 0));
    camera.lookAt(cameraTarget);

    rimLight.position.copy(shipPosition).add(new THREE.Vector3(0, 6, 0));
    stars.position.copy(shipPosition);

    const aimVec = new THREE.Vector3(gunnerAim.x, 0, gunnerAim.y);
    if (aimVec.lengthSq() < 0.0001) {
      aimVec.set(1, 0, 0);
    } else {
      aimVec.normalize();
    }
    const aimLen2d = Math.hypot(gunnerAim.x, gunnerAim.y) || 1;
    const aimX = gunnerAim.x / aimLen2d;
    const aimY = gunnerAim.y / aimLen2d;
    const reticleRange = Math.min(arena.clientWidth, arena.clientHeight) * 0.12;
    reticle.style.transform = `translate(calc(-50% + ${aimX * reticleRange}px), calc(-50% + ${-aimY * reticleRange}px))`;
    const aimLength = 8;
    aimLinePositions[0] = ship.position.x;
    aimLinePositions[1] = ship.position.y + 0.4;
    aimLinePositions[2] = ship.position.z;
    aimLinePositions[3] = ship.position.x + aimVec.x * aimLength;
    aimLinePositions[4] = ship.position.y + 0.4;
    aimLinePositions[5] = ship.position.z + aimVec.z * aimLength;
    gunnerAimGeometry.attributes.position.needsUpdate = true;
    gunnerAimLine.visible = true;
    gunnerAimMaterial.color.setHex(gunnerFiring ? 0xff6b6b : 0xffd166);
    gunnerAimMaterial.opacity = gunnerFiring ? 0.9 : 0.55;
    muzzleFlash.intensity = gunnerFiring ? 1.6 : 0;

    if (crewFeed) {
      const pilotText = `PILOT ${pilotBoostActive ? 'BOOST' : 'CRUISE'} ${pilotMove.x.toFixed(2)},${pilotMove.y.toFixed(2)} L${pilotLift.toFixed(2)}`;
      const gunnerText = `GUNNER ${gunnerFiring ? 'FIRE' : 'HOLD'} AIM ${gunnerAim.x.toFixed(2)},${gunnerAim.y.toFixed(2)}`;
      const powerText = powerInput
        ? `POWER E${powerInput.powerEngines.toFixed(2)} W${powerInput.powerWeapons.toFixed(2)} S${powerInput.powerShields.toFixed(2)}`
        : 'POWER -';
      const systemsText =
        systemsInput && typeof systemsInput.systemsAbility === 'number' && systemsInput.systemsAbility >= 0
          ? `SYSTEMS ${systemAbilityLabels[systemsInput.systemsAbility] ?? systemsInput.systemsAbility}`
          : 'SYSTEMS -';
      const supportText = supportInput?.supportAction ? `SUPPORT ${supportInput.supportAction}` : 'SUPPORT -';
      crewFeed.textContent = [pilotText, gunnerText, powerText, systemsText, supportText].join('\n');
    }

    const systemsState = state.room?.state?.systems;
    const timeNow = state.room?.state?.timeSurvived ?? 0;
    if (systemsState) {
      empRing.visible = systemsState.empUntil > timeNow;
      empRing.position.copy(ship.position);
      const empScale = 1 + (systemsState.empUntil > timeNow ? (systemsState.empUntil - timeNow) * 0.15 : 0);
      empRing.scale.setScalar(empScale);

      slowFieldRing.visible = systemsState.slowFieldUntil > timeNow;
      slowFieldRing.position.copy(ship.position);
      const radius = systemsState.slowFieldRadius || 120;
      slowFieldRing.scale.setScalar(radius / 20);
    } else {
      empRing.visible = false;
      slowFieldRing.visible = false;
    }
    if (systemsState) {
      if (systemsState.empCooldown > sfxState.lastEmpCooldown + 0.5) {
        playSfx('emp', { volume: 0.5, rate: 1 });
      }
      if (systemsState.shieldCooldown > sfxState.lastShieldCooldown + 0.5) {
        playSfx('shield', { volume: 0.5, rate: 0.95 });
      }
      if (systemsState.slowCooldown > sfxState.lastSlowCooldown + 0.5) {
        playSfx('slow', { volume: 0.4, rate: 0.9 });
      }
      if (systemsState.overdriveCooldown > sfxState.lastOverdriveCooldown + 0.5) {
        playSfx('overdrive', { volume: 0.6, rate: 1.05 });
      }
      sfxState.lastEmpCooldown = systemsState.empCooldown;
      sfxState.lastShieldCooldown = systemsState.shieldCooldown;
      sfxState.lastSlowCooldown = systemsState.slowCooldown;
      sfxState.lastOverdriveCooldown = systemsState.overdriveCooldown;
    }

    if (pilotMeta) {
      const reverse = pilotMove.y < -0.1;
      const handbrakeActive =
        state.seat === 'pilot' ? localActions.pilot.handbrake : Boolean(pilotInput?.handbrake);
      pilotMeta.textContent = [
        `SPD ${lastSpeed.toFixed(0)}`,
        reverse ? 'REV' : 'FWD',
        `BOOST ${pilotBoostActive ? 'ON' : 'OFF'}`,
        `HB ${handbrakeActive ? 'ON' : 'OFF'}`
      ].join('\n');
    }

    if (gunnerMeta) {
      let nearestDist = Infinity;
      enemySource?.forEach((enemy) => {
        const dx = enemy.position.x - shipPosition.x;
        const dy = (enemy.position.z ?? 0) - shipPosition.y;
        const dz = enemy.position.y - shipPosition.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < nearestDist) nearestDist = dist;
      });
      gunnerMeta.textContent = [
        `WPN ${state.weapons[gunnerWeaponIndex] ?? 'MG'}`,
        `HEAT ${(gunnerHeat * 100).toFixed(0)}%`,
        `RET ${gunnerFiring ? 'HOT' : 'READY'}`,
        `LOCK ${Number.isFinite(nearestDist) ? nearestDist.toFixed(0) : '--'}`
      ].join('\n');
    }

    if (powerMeta) {
      const power = powerInput ?? {
        powerEngines: shipState.energyEngines,
        powerWeapons: shipState.energyWeapons,
        powerShields: shipState.energyShields
      };
      const overload = shipState.powerOverloadUntil > sceneTime ? 'OVERLOAD' : 'STABLE';
      const perfect = shipState.powerPerfectUntil > sceneTime ? 'PERFECT' : 'NORMAL';
      powerMeta.textContent = [
        `E ${(power.powerEngines * 100).toFixed(0)}%`,
        `W ${(power.powerWeapons * 100).toFixed(0)}%`,
        `S ${(power.powerShields * 100).toFixed(0)}%`,
        `PRE ${localActions.power.preset.toUpperCase()}`,
        `${overload} / ${perfect}`
      ].join('\n');
    }
    if (powerBarEng && shipState) {
      const energyEng = shipState.energyEngines ?? 0.33;
      const energyWep = shipState.energyWeapons ?? 0.33;
      const energyShd = shipState.energyShields ?? 0.34;
      powerBarEng.style.transform = `scaleX(${Math.min(1, Math.max(0, energyEng))})`;
      powerBarWep.style.transform = `scaleX(${Math.min(1, Math.max(0, energyWep))})`;
      powerBarShd.style.transform = `scaleX(${Math.min(1, Math.max(0, energyShd))})`;
      const instability = Math.min(1, Math.max(0, shipState.powerInstability ?? 0));
      powerInstability.style.transform = `scaleX(${instability})`;
      const heat = Math.min(1, Math.max(0, (shipState.powerHeat ?? 0) / 1.2));
      powerHeat.style.transform = `scaleX(${heat})`;
      const windowEnd = shipState.powerWindowEnd ?? 0;
      const windowStart = shipState.powerWindowStart ?? 0;
      const windowActive = windowEnd > sceneTime;
      const pct = windowActive && windowEnd > windowStart ? Math.min(1, Math.max(0, (sceneTime - windowStart) / (windowEnd - windowStart))) : 0;
      powerWindow.style.transform = `scaleX(${pct})`;
      powerWindow.classList.toggle('active', windowActive);
    }

    if (systemsMeta) {
      const ability =
        systemsInput && typeof systemsInput.systemsAbility === 'number' && systemsInput.systemsAbility >= 0
          ? systemAbilityLabels[systemsInput.systemsAbility] ?? `#${systemsInput.systemsAbility}`
          : 'READY';
      const systemsState = state.room?.state?.systems;
      const cd =
        systemsState?.empCooldown ||
        systemsState?.shieldCooldown ||
        systemsState?.slowCooldown ||
        systemsState?.overdriveCooldown
          ? `CD ${Math.max(
              systemsState?.empCooldown ?? 0,
              systemsState?.shieldCooldown ?? 0,
              systemsState?.slowCooldown ?? 0,
              systemsState?.overdriveCooldown ?? 0
            ).toFixed(1)}s`
          : 'CD READY';
      systemsMeta.textContent = [`${ability}`, cd].join('\n');
    }
    if (systemsModes) {
      const systemsState = state.room?.state?.systems;
      if (systemsState) {
        systemsModes.textContent = [
          `EMP ${systemsState.empMode?.toUpperCase() ?? 'STANDARD'}`,
          `SHIELD ${systemsState.shieldMode?.toUpperCase() ?? 'STANDARD'}`,
          `SLOW ${systemsState.slowMode?.toUpperCase() ?? 'STANDARD'}`,
          `OVER ${systemsState.overdriveMode?.toUpperCase() ?? 'STANDARD'}`
        ].join('\n');
      } else {
        systemsModes.textContent = '';
      }
    }

    if (supportMeta) {
      const supportStateLocal = state.room?.state?.support;
      supportMeta.textContent = [
        `PING ${supportStateLocal?.pingCooldown ? supportStateLocal.pingCooldown.toFixed(1) + 's' : 'READY'}`,
        `REPAIR ${
          supportStateLocal?.repairCooldown ? supportStateLocal.repairCooldown.toFixed(1) + 's' : 'READY'
        }`,
        `RADAR ${supportStateLocal?.radarUntil ? supportStateLocal.radarUntil.toFixed(1) + 's' : 'OFF'}`
      ].join('\n');
    }
    const supportState = state.room?.state?.support;
    if (supportState) {
      if (supportState.pingCooldown > sfxState.lastPingCooldown + 0.5) {
        playSfx('scan', { volume: 0.45, rate: 1.05 });
      }
      if (supportState.repairCooldown > sfxState.lastRepairCooldown + 0.5) {
        playSfx('repair', { volume: 0.5, rate: 0.95 });
      }
      sfxState.lastPingCooldown = supportState.pingCooldown;
      sfxState.lastRepairCooldown = supportState.repairCooldown;
      const radarPct = Math.min(1, Math.max(0, (supportState.radarUntil ?? 0) / 6));
      supportRadar.style.transform = `scaleX(${radarPct})`;
      const windowEnd = supportState.repairWindowEnd ?? 0;
      const windowStart = supportState.repairWindowStart ?? 0;
      const windowActive = windowEnd > sceneTime;
      const windowPct = windowActive && windowEnd > windowStart ? Math.min(1, Math.max(0, (sceneTime - windowStart) / (windowEnd - windowStart))) : 0;
      supportRepairWindow.style.transform = `scaleX(${windowPct})`;
      supportRepairWindow.classList.toggle('active', windowActive);
    } else {
      supportRadar.style.transform = 'scaleX(0)';
      supportRepairWindow.style.transform = 'scaleX(0)';
    }

    const comboUntil = state.room?.state?.comboUntil ?? 0;
    if (comboToast) {
      if (comboUntil > sceneTime) {
        const name = state.room?.state?.comboName ?? 'Combo';
        const detail = state.room?.state?.comboDetail ?? '';
        comboToast.textContent = detail ? `${name} — ${detail}` : name;
        comboToast.classList.add('active');
      } else {
        comboToast.classList.remove('active');
      }
    }

    if (crewPilotMeta) {
      crewPilotMeta.textContent = [
        `SPD ${lastSpeed.toFixed(0)}`,
        `${pilotBoostActive ? 'BOOST' : 'CRUISE'}`,
        `MOVE ${pilotMove.x.toFixed(1)},${pilotMove.y.toFixed(1)}`
      ].join('\n');
    }
    if (crewGunnerMeta) {
      crewGunnerMeta.textContent = [
        `WPN ${state.weapons[gunnerWeaponIndex] ?? 'MG'}`,
        `FIRE ${gunnerFiring ? 'ON' : 'OFF'}`,
        `AIM ${gunnerAim.x.toFixed(1)},${gunnerAim.y.toFixed(1)}`
      ].join('\n');
    }
    if (crewPowerMeta && shipState) {
      crewPowerMeta.textContent = [
        `E ${(shipState.energyEngines * 100).toFixed(0)}%`,
        `W ${(shipState.energyWeapons * 100).toFixed(0)}%`,
        `S ${(shipState.energyShields * 100).toFixed(0)}%`,
        `INST ${(shipState.powerInstability ?? 0).toFixed(2)}`
      ].join('\n');
    }
    if (crewSystemsMeta) {
      const systemsState = state.room?.state?.systems;
      crewSystemsMeta.textContent = systemsState
        ? [
            `EMP ${systemsState.empMode?.toUpperCase() ?? 'STD'}`,
            `SHD ${systemsState.shieldMode?.toUpperCase() ?? 'STD'}`,
            `SLW ${systemsState.slowMode?.toUpperCase() ?? 'STD'}`,
            `OVR ${systemsState.overdriveMode?.toUpperCase() ?? 'STD'}`
          ].join('\n')
        : '';
    }
    if (crewSupportMeta) {
      crewSupportMeta.textContent = supportState
        ? [
            `PING ${supportState.pingCooldown ? supportState.pingCooldown.toFixed(1) + 's' : 'READY'}`,
            `REP ${supportState.repairCooldown ? supportState.repairCooldown.toFixed(1) + 's' : 'READY'}`,
            `RAD ${supportState.radarUntil ? supportState.radarUntil.toFixed(1) + 's' : 'OFF'}`
          ].join('\n')
        : '';
    }

    if (!e2eState && supportState) {
      if (supportState.repairCooldown > lastRepairCooldown + 0.2) {
        spawnSpark(ship.position.x, ship.position.z, 0x7cff7a, 1.6);
      }
      lastRepairCooldown = supportState.repairCooldown;
    }

    if (arenaStats) {
      if (e2eState) {
        const enemyCount = enemySource?.length ?? 0;
        const projectileCount = projectileSource?.length ?? 0;
        arenaStats.textContent = [`E ${enemyCount} | P ${projectileCount}`, `W ${e2eState.wave}`].join('\n');
      } else {
        const rtt = state.room?.connection && 'rtt' in state.room.connection ? state.room.connection.rtt : 0;
        const serverPos = `${shipState.position.x.toFixed(1)},${shipState.position.y.toFixed(1)},${(shipState.position.z ?? 0).toFixed(1)}`;
        const renderPos = `${renderShipPosition.x.toFixed(1)},${renderShipPosition.z.toFixed(1)},${renderShipPosition.y.toFixed(1)}`;
        arenaStats.textContent = [
          `FPS ${fps.toFixed(0)}`,
          `RTT ${rtt ? rtt.toFixed(0) : '0'}ms`,
          `Tick ${serverTickHz.toFixed(1)}hz`,
          `Server ${serverPos}`,
          `Render ${renderPos}`,
          `Cam ${cameraState.distance.toFixed(1)}${cameraState.collision ? ' COL' : ''}`,
          `E ${state.room?.state?.enemies?.length ?? 0} | P ${state.room?.state?.projectiles?.length ?? 0}`
        ].join('\n');
      }
    }

    if (shipStatus && shipState) {
      const shield = Math.max(0, shipState.shield ?? 0);
      shipStatus.textContent = [`HP ${shipState.health.toFixed(0)}`, `SHD ${shield.toFixed(0)}`].join('\n');
    }

    if (getRoomMode() === 'solo') {
      const activeRemotes = new Set<string>();
      remoteShips.forEach(({ id, ship }) => {
        activeRemotes.add(id);
        const mesh = ensureAllyShip(id);
        const shipZ = ship.position.z ?? 0;
        mesh.position.set(ship.position.x, shipZ, ship.position.y);
        const heading = ship.heading ?? 0;
        mesh.rotation.y = heading;
        mesh.rotation.z = 0;
        mesh.rotation.x = 0;
      });
      allyShips.forEach((mesh, id) => {
        if (activeRemotes.has(id)) return;
        scene.remove(mesh);
        allyShips.delete(id);
      });
    } else if (allyShips.size) {
      clearAllyShips();
    }

    if (shipState && enemySource) {
      drawMiniMap(
        shipState as { position: { x: number; y: number }; visionRadius?: number },
        enemySource,
        remoteShips
      );
    }

    const active = new Set<string>();
    const markedNow = sceneTime;
    const visionRadiusSq = (shipState.visionRadius ?? 160) * (shipState.visionRadius ?? 160);
    enemySource?.forEach((enemy) => {
      if (enemy.health <= 0) return;
      active.add(enemy.id);
      let mesh = enemies.get(enemy.id);
      if (!mesh) {
        const template = enemyTemplates[enemy.kind as EnemyKind] ?? enemyTemplates.chaser;
        mesh = acquireEnemyMesh(enemy.kind as EnemyKind, template);
        const anims = mesh.userData.animations as THREE.AnimationClip[] | undefined;
        if (anims && anims.length) {
          const mixer = new THREE.AnimationMixer(mesh);
          mixer.clipAction(anims[0]).reset().play();
          enemyMixers.set(enemy.id, mixer);
        }
        enemies.set(enemy.id, mesh);
      }
      const size =
        enemy.kind === 'boss-warden' || enemy.kind === 'boss-siren' || enemy.kind === 'boss-behemoth'
          ? 3.3
          : enemy.kind === 'spitter'
            ? 1.4
            : enemy.kind === 'runner'
              ? 1.2
              : enemy.kind === 'brute'
                ? 1.65
                : enemy.kind === 'lurker'
                  ? 1.3
                  : enemy.kind === 'swarm'
                    ? 1.1
                    : 1.2;
      const enemyZ = enemy.position.z ?? 0;
      mesh.position.set(enemy.position.x, enemyZ, enemy.position.y);
      const dx = enemy.position.x - shipPosition.x;
      const dy = enemyZ - shipPosition.y;
      const dz = enemy.position.y - shipPosition.z;
      const visible = dx * dx + dy * dy + dz * dz <= visionRadiusSq * 1.05;
      mesh.visible = visible;
      if ('yaw' in enemy) {
        mesh.rotation.y = (enemy as { yaw?: number }).yaw ?? mesh.rotation.y;
      }
      const baseScale = mesh.userData.baseScale as THREE.Vector3 | undefined;
      if (baseScale) {
        mesh.scale.set(baseScale.x * size, baseScale.y * size, baseScale.z * size);
      } else {
        mesh.scale.setScalar(size);
      }

      const marked = 'markedUntil' in enemy && (enemy as { markedUntil?: number }).markedUntil > markedNow;
      const exposed = 'exposedUntil' in enemy && (enemy as { exposedUntil?: number }).exposedUntil > markedNow;
      const volatile = 'volatileUntil' in enemy && (enemy as { volatileUntil?: number }).volatileUntil > markedNow;
      const tracking = 'trackingUntil' in enemy && (enemy as { trackingUntil?: number }).trackingUntil > markedNow;
      const weakpoint = 'weakpointUntil' in enemy && (enemy as { weakpointUntil?: number }).weakpointUntil > markedNow;
      const statusActive = marked || exposed || volatile || tracking || weakpoint;
      let marker = markedIndicators.get(enemy.id);
      if (statusActive && visible) {
        if (!marker) {
          marker = new THREE.Sprite(markedIndicatorMaterial.clone());
          markedIndicators.set(enemy.id, marker);
          scene.add(marker);
        }
        const material = marker.material as THREE.SpriteMaterial;
        if (weakpoint) material.color.setHex(0xb26bff);
        else if (volatile) material.color.setHex(0xff9b2f);
        else if (tracking) material.color.setHex(0x5dff99);
        else if (exposed) material.color.setHex(0x6cf6ff);
        else material.color.setHex(0xffd166);
        const scale = 1.4 * (settings.markOutline / 110) * (radarActive ? 1.35 : 1);
        marker.scale.set(scale, scale, scale);
        marker.position.set(enemy.position.x, enemyZ + 2.8, enemy.position.y);
      } else if (marker) {
        scene.remove(marker);
        markedIndicators.delete(enemy.id);
      }

      const telegraphActive =
        (enemy.kind === 'boss-warden' || enemy.kind === 'boss-siren' || enemy.kind === 'boss-behemoth') &&
        'telegraphUntil' in enemy &&
        (enemy as { telegraphUntil?: number }).telegraphUntil > markedNow;
      let telegraph = bossTelegraphs.get(enemy.id);
      if (telegraphActive && visible) {
        if (!telegraph) {
          telegraph = new THREE.Sprite(bossTelegraphMaterial.clone());
          bossTelegraphs.set(enemy.id, telegraph);
          scene.add(telegraph);
        }
        const scale = 2.2 * (settings.markOutline / 110) * (radarActive ? 1.2 : 1);
        telegraph.scale.set(scale, scale, scale);
        telegraph.position.set(enemy.position.x, enemyZ + 3.4, enemy.position.y);
      } else if (telegraph) {
        scene.remove(telegraph);
        bossTelegraphs.delete(enemy.id);
      }
    });
    enemies.forEach((mesh, id) => {
      if (active.has(id)) return;
      const kind = (mesh.userData.kind as EnemyKind) ?? 'chaser';
      const color =
        kind === 'boss-warden' || kind === 'boss-siren' || kind === 'boss-behemoth'
          ? 0xff3b3b
          : kind === 'spitter'
            ? 0xb87bff
            : kind === 'runner'
              ? 0xffb347
              : kind === 'lurker'
                ? 0x58dfff
                : kind === 'brute'
                  ? 0xff7c58
                  : kind === 'swarm'
                    ? 0xffd65c
                    : 0xff4f4f;
      const bossScale = kind === 'boss-warden' || kind === 'boss-siren' || kind === 'boss-behemoth' ? 3 : 1.6;
      spawnSpark(mesh.position.x, mesh.position.z, color, bossScale);
      enemies.delete(id);
      enemyMixers.delete(id);
      releaseEnemyMesh(mesh);
      const marker = markedIndicators.get(id);
      if (marker) {
        scene.remove(marker);
        markedIndicators.delete(id);
      }
      const telegraph = bossTelegraphs.get(id);
      if (telegraph) {
        scene.remove(telegraph);
        bossTelegraphs.delete(id);
      }
    });
    enemyMixers.forEach((mixer, id) => {
      if (active.has(id)) {
        mixer.update(dt);
      }
    });

    if (radar) {
      radar.style.display = radarActive ? 'block' : 'none';
      if (radarActive && enemySource) {
        radar.innerHTML = '';
        const radarRadius = 70;
        const maxRange = 220;
        enemySource.forEach((enemy) => {
          const dx = enemy.position.x - shipPosition.x;
          const dz = enemy.position.y - shipPosition.z;
          const dist = Math.hypot(dx, dz);
          if (dist > maxRange) return;
          const dot = document.createElement('div');
          dot.className = 'radar-dot';
          const marked =
            'markedUntil' in enemy && (enemy as { markedUntil?: number }).markedUntil > markedNow;
          const exposed = 'exposedUntil' in enemy && (enemy as { exposedUntil?: number }).exposedUntil > markedNow;
          const volatile = 'volatileUntil' in enemy && (enemy as { volatileUntil?: number }).volatileUntil > markedNow;
          const tracking = 'trackingUntil' in enemy && (enemy as { trackingUntil?: number }).trackingUntil > markedNow;
          const weakpoint = 'weakpointUntil' in enemy && (enemy as { weakpointUntil?: number }).weakpointUntil > markedNow;
          if (marked) dot.classList.add('marked');
          if (exposed) dot.classList.add('exposed');
          if (volatile) dot.classList.add('volatile');
          if (tracking) dot.classList.add('tracking');
          if (weakpoint) dot.classList.add('weakpoint');
          const nx = dx / maxRange;
          const nz = dz / maxRange;
          dot.style.left = `${radarRadius + nx * radarRadius}px`;
          dot.style.top = `${radarRadius + nz * radarRadius}px`;
          radar.appendChild(dot);
        });
      }
    }
  } else {
    gunnerAimLine.visible = false;
  }

  powerups.forEach((mesh, idx) => {
    mesh.rotation.y += dt * (0.8 + idx * 0.2);
    mesh.rotation.x += dt * 0.6;
  });
  stars.rotation.y += dt * 0.02;

  gunnerHeat = Math.max(0, Math.min(1, gunnerHeat + (gunnerFiring ? 0.8 : -1.2) * dt));

  const activeProjectiles = new Set<string>();
  projectileSource?.forEach((projectile) => {
    activeProjectiles.add(projectile.id);
    const owner = 'owner' in projectile ? (projectile as { owner?: string }).owner : undefined;
    const cached = projectileAudioCache.get(projectile.id);
    if (!cached) {
      projectileAudioCache.set(projectile.id, {
        kind: projectile.kind,
        owner,
        x: projectile.position.x,
        y: projectile.position.y
      });
      if (owner === 'player') {
        triggerWeaponSfx(projectile.kind, sceneTime);
      }
    } else {
      cached.x = projectile.position.x;
      cached.y = projectile.position.y;
    }
    let mesh = projectileMeshes.get(projectile.id);
    if (!mesh) {
      mesh = acquireProjectile(projectile.kind);
      projectileMeshes.set(projectile.id, mesh);
    }
    const style = projectileStyles[projectile.kind] ?? projectileStyles.mg;
    const projectileZ = projectile.position.z ?? 0;
    mesh.position.set(projectile.position.x, projectileZ + style.y, projectile.position.y);
    const vx = projectile.velocity.x;
    const vz = projectile.velocity.y;
    if (Math.hypot(vx, vz) > 0.001) {
      mesh.rotation.y = Math.atan2(vx, vz);
    }
    const glow = mesh.userData.glow as THREE.Sprite | undefined;
    if (glow) {
      const pulse = e2eState ? 0.75 : 0.6 + Math.sin(performance.now() * 0.01) * 0.25;
      glow.material.opacity = pulse;
      glow.scale.set(1.0 * style.scale + pulse, 1.0 * style.scale + pulse, 1);
    }
  });
  projectileAudioCache.forEach((cached, id) => {
    if (activeProjectiles.has(id)) return;
    if (cached.owner === 'player' && (cached.kind === 'rocket' || cached.kind === 'cannon')) {
      if (sceneTime - sfxCooldowns.explosion > 0.2) {
        playSfx('explosion', { volume: 0.6, rate: 0.9 + Math.random() * 0.1 });
        sfxCooldowns.explosion = sceneTime;
      }
      spawnSpark(cached.x, cached.y, 0xff6b6b, 2.4);
    }
    projectileAudioCache.delete(id);
  });
  projectileMeshes.forEach((mesh, id) => {
    if (activeProjectiles.has(id)) return;
    const kind = (mesh.userData.kind as string) ?? 'mg';
    if (kind === 'rocket' || kind === 'cannon' || kind === 'boss' || kind === 'plasma') {
      const color = kind === 'rocket' ? 0xff6b6b : kind === 'cannon' ? 0xffb347 : 0xff3b3b;
      spawnSpark(mesh.position.x, mesh.position.z, color, kind === 'rocket' ? 2.4 : 1.8);
    }
    projectileMeshes.delete(id);
    releaseProjectile(mesh);
  });

  for (let i = sparkEffects.length - 1; i >= 0; i -= 1) {
    const effect = sparkEffects[i];
    effect.ttl -= dt;
    const t = Math.max(0, effect.ttl / effect.max);
    const material = effect.sprite.material as THREE.SpriteMaterial;
    material.opacity = t;
    const base = effect.sprite.userData.baseScale as number;
    const scale = base * (1 + (1 - t) * 0.6);
    effect.sprite.scale.set(scale, scale, scale);
    if (effect.ttl <= 0) {
      scene.remove(effect.sprite);
      sparkEffects.splice(i, 1);
    }
  }
}

let lastFrame = performance.now();
function renderLoop(now: number) {
  const dt = e2eVisualsEnabled ? 0 : Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  frameCount += 1;
  if (now - lastFpsAt >= 1000) {
    fps = (frameCount * 1000) / (now - lastFpsAt);
    frameCount = 0;
    lastFpsAt = now;
  }
  requestAnimationFrame(renderLoop);
  updateScene(dt);
  renderer.render(scene, camera);
  if (e2eStatus && !e2eStatus.ready) {
    if (e2eScene === 'cave') {
      e2eStatus.ready = caveBuilt;
    } else if (frameCount > 2) {
      e2eStatus.ready = true;
    }
  }
}

requestAnimationFrame(renderLoop);

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
