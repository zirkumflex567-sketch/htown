import argon2 from "argon2";
import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { Database } from "../db/types";
import { createAccessToken, createRefreshToken, verifyToken } from "./tokens";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export function createAuthRouter(db: Database): express.Router {
  const router = express.Router();
  const limiter = rateLimit({ windowMs: 60_000, max: 20 });

  router.post("/register", limiter, async (req, res) => {
    const parse = credentialsSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "Invalid payload" });
    }
    const { email, password } = parse.data;
    const existing = await db.findAccountByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "Account already exists" });
    }
    const passwordHash = await argon2.hash(password);
    const account = await db.createAccount(email, passwordHash);
    const accessToken = createAccessToken(account.id);
    const refresh = createRefreshToken(account.id);
    await db.saveRefreshToken(account.id, refresh.token, refresh.expiresAt);
    return res.json({ accessToken, refreshToken: refresh.token });
  });

  router.post("/login", limiter, async (req, res) => {
    const parse = credentialsSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "Invalid payload" });
    }
    const { email, password } = parse.data;
    const account = await db.findAccountByEmail(email);
    if (!account) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await argon2.verify(account.password_hash, password);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const accessToken = createAccessToken(account.id);
    const refresh = createRefreshToken(account.id);
    await db.saveRefreshToken(account.id, refresh.token, refresh.expiresAt);
    return res.json({ accessToken, refreshToken: refresh.token });
  });

  router.post("/refresh", async (req, res) => {
    const token = req.body?.refreshToken as string | undefined;
    if (!token) {
      return res.status(400).json({ error: "Missing refresh token" });
    }
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
    const stored = await db.findRefreshToken(token);
    if (!stored || stored.expires_at < Date.now()) {
      return res.status(401).json({ error: "Refresh token expired" });
    }
    const accessToken = createAccessToken(payload.sub);
    return res.json({ accessToken });
  });

  router.post("/logout", async (req, res) => {
    const token = req.body?.refreshToken as string | undefined;
    if (token) {
      await db.revokeRefreshToken(token);
    }
    res.status(204).send();
  });

  return router;
}
