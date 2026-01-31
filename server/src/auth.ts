import jwt from 'jsonwebtoken';

export type TokenPayload = {
  sub: string;
  email: string;
};

const ACCESS_TTL_SECONDS = 60 * 10;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7;

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

export function createAccessToken(payload: TokenPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL_SECONDS });
}

export function createRefreshToken(payload: TokenPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TTL_SECONDS });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export function getRefreshExpiry() {
  return Date.now() + REFRESH_TTL_SECONDS * 1000;
}
