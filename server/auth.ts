import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { store, StoredUser } from './store.js';

const FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getJwtSecret(): string {
  const configured = (process.env.JWT_SECRET || '').trim();
  return configured || FALLBACK_SECRET;
}

export interface JwtPayload {
  sub: string;
  role: 'OWNER' | 'PLAYER';
  tv: number;
}

export function signAuthToken(user: StoredUser): string {
  const payload: JwtPayload = {
    sub: user.id,
    role: user.role,
    tv: user.tokenVersion,
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyAuthToken(token: string): StoredUser | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    const user = store.findUserById(decoded.sub);
    if (!user) return null;
    if (user.tokenVersion !== decoded.tv) return null;
    if (user.status === 'BANNED') return null;
    if (user.status === 'SUSPENDED' && user.suspendedUntil && user.suspendedUntil > Date.now()) {
      return null;
    }
    if (user.status === 'SUSPENDED' && user.suspendedUntil && user.suspendedUntil <= Date.now()) {
      user.status = 'ACTIVE';
      user.suspendedUntil = null;
      store.save();
    }
    return user;
  } catch {
    return null;
  }
}

export function extractTokenFromRequest(req: Request): { token: string | null; viaCookie: boolean } {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return { token: authHeader.slice(7).trim(), viaCookie: false };
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const [k, ...v] = part.trim().split('=');
      if (k === 'carter_session') {
        return { token: decodeURIComponent(v.join('=')), viaCookie: true };
      }
    }
  }
  return { token: null, viaCookie: false };
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie('carter_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie('carter_session', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
  });
}

export interface AuthedRequest extends Request {
  user?: StoredUser;
}

export function authenticateRequest(req: AuthedRequest, res: Response, next: NextFunction) {
  const { token, viaCookie } = extractTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  // CSRF protection when cookie-authenticated on state-changing requests
  if (viaCookie && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    const origin = req.headers.origin;
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          res.status(403).json({ error: 'Origin mismatch.' });
          return;
        }
      } catch {
        res.status(403).json({ error: 'Invalid origin header.' });
        return;
      }
    }
  }
  const user = verifyAuthToken(token);
  if (!user) {
    res.status(401).json({ error: 'Session expired or account restricted.' });
    return;
  }
  req.user = user;
  next();
}

export function requireOwner(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'OWNER' || req.user.username.toLowerCase() !== 'lmxynnn') {
    res.status(403).json({ error: 'Owner authorization required.' });
    return;
  }
  next();
}

// RFC 6238 TOTP generator & verifier using built-in Node crypto
const BASE32_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let out = '';
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHA[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHA[(value << (5 - bits)) & 31];
  return out;
}

function base32ToBuffer(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHA.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const key = base32ToBuffer(secret);
  const nowStep = Math.floor(Date.now() / 30000);
  for (let offset = -1; offset <= 1; offset++) {
    const counter = Buffer.alloc(8);
    counter.writeUInt32BE(0, 0);
    counter.writeUInt32BE(nowStep + offset, 4);
    const hmac = crypto.createHmac('sha1', key).update(counter).digest();
    const pos = hmac[hmac.length - 1] & 0x0f;
    const bin =
      ((hmac[pos] & 0x7f) << 24) |
      ((hmac[pos + 1] & 0xff) << 16) |
      ((hmac[pos + 2] & 0xff) << 8) |
      (hmac[pos + 3] & 0xff);
    const otp = String(bin % 1000000).padStart(6, '0');
    if (otp === normalized) return true;
  }
  return false;
}
