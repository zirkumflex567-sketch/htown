import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { matchMaker } from "colyseus";
import { createDatabase } from "./db";
import { createAuthRouter } from "./auth/routes";
import { createLeaderboardRouter } from "./services/leaderboard";
import { GameRoom } from "./rooms/GameRoom";

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server }) });

const db = await createDatabase();
GameRoom.database = db;

gameServer.define("game", GameRoom);

app.use("/auth", createAuthRouter(db));
app.use("/leaderboard", createLeaderboardRouter(db));

app.post("/match/create", async (req, res) => {
  const { code } = req.body ?? {};
  const room = await matchMaker.createRoom("game", { code });
  res.json({ roomId: room.roomId, code: code ?? room.roomId.slice(0, 6) });
});

app.post("/match/join", async (req, res) => {
  const { code } = req.body ?? {};
  if (!code) {
    return res.status(400).json({ error: "Missing room code" });
  }
  const room = await matchMaker.findOne("game", { code });
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  return res.json({ roomId: room.roomId, code });
});

app.post("/match/quick", async (_req, res) => {
  const room = await matchMaker.joinOrCreate("game", {});
  res.json({ roomId: room.roomId });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

gameServer.listen(PORT);
console.log(`Server listening on ${PORT}`);
