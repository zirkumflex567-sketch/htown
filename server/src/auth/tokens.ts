import jwt from "jsonwebtoken";

const accessTtlSeconds = 60 * 15;
const refreshTtlSeconds = 60 * 60 * 24 * 14;

export function createAccessToken(accountId: string): string {
  return jwt.sign({ sub: accountId }, process.env.JWT_SECRET ?? "dev-secret", {
    expiresIn: accessTtlSeconds,
  });
}

export function createRefreshToken(accountId: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + refreshTtlSeconds * 1000;
  const token = jwt.sign({ sub: accountId, type: "refresh" }, process.env.JWT_SECRET ?? "dev-secret", {
    expiresIn: refreshTtlSeconds,
  });
  return { token, expiresAt };
}

export function verifyToken(token: string): { sub: string } | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET ?? "dev-secret") as { sub: string };
  } catch {
    return null;
  }
}
