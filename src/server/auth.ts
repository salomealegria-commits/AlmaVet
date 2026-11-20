import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { AuthUser, UserRole } from '../types/domain.ts';
import { db } from './db.ts';

const COOKIE_NAME = 'almavet_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'almavet-dev-session-secret-change-in-prod';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function signPayload(payloadB64: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
}

function isSecureRequest(req?: Request): boolean {
  if (!req) return false;
  const proto = req.headers['x-forwarded-proto'];
  return req.secure || proto === 'https' || (Array.isArray(proto) && proto.includes('https'));
}

export function setSessionCookie(req: Request, res: Response, userId: number): void {
  const payload = JSON.stringify({ uid: userId, iat: Date.now() });
  const payloadB64 = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = signPayload(payloadB64);
  const token = `${payloadB64}.${sig}`;
  const secure = isSecureRequest(req);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  const secure = isSecureRequest(req);
  res.clearCookie(COOKIE_NAME, {
    path: '/',
    sameSite: secure ? 'none' : 'lax',
    secure,
  });
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    result[key] = decodeURIComponent(val);
  }
  return result;
}

export function getSessionUser(req: Request): AuthUser | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = signPayload(payloadB64);

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { uid: number };
    const row = db
      .prepare(
        `SELECT u.id, u.nombre, u.email, u.telefono, u.direccion_entrega, u.activo, r.nombre AS rol, v.id AS veterinario_id
         FROM usuarios u
         INNER JOIN roles r ON r.id = u.rol_id
         LEFT JOIN veterinarios v ON v.usuario_id = u.id
         WHERE u.id = ? LIMIT 1`
      )
      .get(parsed.uid) as
      | {
          id: number;
          nombre: string;
          email: string;
          telefono: string | null;
          direccion_entrega: string | null;
          activo: number;
          rol: UserRole;
          veterinario_id: number | null;
        }
      | undefined;

    if (!row || !row.activo) return null;

    return {
      id: Number(row.id),
      nombre: String(row.nombre),
      email: String(row.email),
      telefono: row.telefono ? String(row.telefono) : null,
      direccion_entrega: row.direccion_entrega ? String(row.direccion_entrega) : null,
      rol: row.rol,
      veterinario_id: row.veterinario_id ? Number(row.veterinario_id) : null,
    };
  } catch {
    return null;
  }
}

export function requireAuth(allowedRoles: UserRole[] = []) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = getSessionUser(req);
    if (!user) {
      res.status(401).json({ ok: false, error: 'Sesión requerida. Inicia sesión para continuar.' });
      return;
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.rol)) {
      res.status(403).json({ ok: false, error: 'No tienes permisos suficientes para realizar esta acción.' });
      return;
    }
    (req as Request & { authUser: AuthUser }).authUser = user;
    next();
  };
}
