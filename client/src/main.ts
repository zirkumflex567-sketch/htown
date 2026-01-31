import "./style.css";
import { Client } from "colyseus.js";
import type { Room } from "colyseus.js";
import type { RoomState } from "@htown/shared";
import { createGame, GameScene } from "./game";

const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:2567";
const wsBase = import.meta.env.VITE_WS_URL ?? "ws://localhost:2567";

const statusEl = document.getElementById("status") as HTMLDivElement;
const authPanel = document.getElementById("auth-panel") as HTMLDivElement;
const lobbyPanel = document.getElementById("lobby-panel") as HTMLDivElement;

const emailInput = document.getElementById("email") as HTMLInputElement;
const passwordInput = document.getElementById("password") as HTMLInputElement;
const displayNameInput = document.getElementById("display-name") as HTMLInputElement;

const registerBtn = document.getElementById("register") as HTMLButtonElement;
const loginBtn = document.getElementById("login") as HTMLButtonElement;
const createBtn = document.getElementById("create-room") as HTMLButtonElement;
const joinBtn = document.getElementById("join-room") as HTMLButtonElement;
const quickBtn = document.getElementById("quick-play") as HTMLButtonElement;
const roomCodeInput = document.getElementById("room-code") as HTMLInputElement;

const client = new Client(wsBase);
let accessToken = localStorage.getItem("accessToken") ?? "";
let refreshToken = localStorage.getItem("refreshToken") ?? "";
let room: Room<RoomState> | null = null;
let gameScene: GameScene | null = null;

function setStatus(message: string): void {
  statusEl.textContent = message;
}

async function request(path: string, body: unknown): Promise<Response> {
  return fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function refreshAccessToken(): Promise<void> {
  if (!refreshToken) return;
  const response = await request("/auth/refresh", { refreshToken });
  if (!response.ok) return;
  const data = (await response.json()) as { accessToken: string };
  accessToken = data.accessToken;
  localStorage.setItem("accessToken", accessToken);
}

async function authenticate(path: string): Promise<void> {
  const response = await request(path, {
    email: emailInput.value,
    password: passwordInput.value,
  });
  if (!response.ok) {
    setStatus("Auth failed");
    return;
  }
  const data = (await response.json()) as { accessToken: string; refreshToken: string };
  accessToken = data.accessToken;
  refreshToken = data.refreshToken;
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
  authPanel.hidden = true;
  lobbyPanel.hidden = false;
  setStatus("Authenticated");
}

async function ensureAuth(): Promise<boolean> {
  if (!accessToken && refreshToken) {
    await refreshAccessToken();
  }
  if (!accessToken) {
    setStatus("Please login");
    return false;
  }
  return true;
}

async function joinRoom(roomId: string): Promise<void> {
  if (!(await ensureAuth())) return;
  room = await client.joinById<RoomState>(roomId, {
    accessToken,
    name: displayNameInput.value || "Commander",
  });
  const game = createGame(room);
  const scene = game.scene.keys.game as GameScene;
  gameScene = scene;
  setStatus(`Connected to room ${roomId}`);
}

registerBtn.addEventListener("click", () => authenticate("/auth/register"));
loginBtn.addEventListener("click", () => authenticate("/auth/login"));

createBtn.addEventListener("click", async () => {
  if (!(await ensureAuth())) return;
  const response = await request("/match/create", { code: roomCodeInput.value || undefined });
  if (!response.ok) return;
  const data = (await response.json()) as { roomId: string; code: string };
  roomCodeInput.value = data.code;
  await joinRoom(data.roomId);
});

joinBtn.addEventListener("click", async () => {
  if (!(await ensureAuth())) return;
  const response = await request("/match/join", { code: roomCodeInput.value });
  if (!response.ok) {
    setStatus("Room not found");
    return;
  }
  const data = (await response.json()) as { roomId: string };
  await joinRoom(data.roomId);
});

quickBtn.addEventListener("click", async () => {
  if (!(await ensureAuth())) return;
  const response = await request("/match/quick", {});
  if (!response.ok) return;
  const data = (await response.json()) as { roomId: string };
  await joinRoom(data.roomId);
});

window.addEventListener("keydown", (event) => {
  if (!gameScene) return;
  if (event.key === "1") gameScene.handleUpgradeChoice(0);
  if (event.key === "2") gameScene.handleUpgradeChoice(1);
  if (event.key === "3") gameScene.handleUpgradeChoice(2);
});

if (accessToken) {
  authPanel.hidden = true;
  lobbyPanel.hidden = false;
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}
