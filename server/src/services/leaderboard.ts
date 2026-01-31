import express from "express";
import type { Database } from "../db/types";
import { requireAuth } from "../auth/middleware";

export function createLeaderboardRouter(db: Database): express.Router {
  const router = express.Router();

  router.get("/top", async (_req, res) => {
    const rows = await db.topScores(50);
    res.json({ entries: rows });
  });

  router.get("/me", requireAuth, async (req, res) => {
    const accountId = (req as Request & { accountId: string }).accountId;
    const best = await db.bestScoreFor(accountId);
    res.json({ bestScore: best ?? 0 });
  });

  return router;
}
