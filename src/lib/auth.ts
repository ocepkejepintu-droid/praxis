import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { canAcpKey, verifyAcpApiKey, type AcpPermission, type PublicAcpApiKey } from './acp';
import { canUser, verifyUserSession, type PublicUserAccount } from './accounts';

const AUTH_COOKIE = 'agent_praxis_session';

function editToken() {
  return process.env.AGENT_PRAXIS_TOKEN || process.env.HERMES_INGEST_TOKEN || '';
}

export function hasEditToken() {
  return Boolean(editToken());
}

export function isValidEditToken(value?: string | null) {
  const token = editToken();
  if (!token || !value) return false;
  const left = Buffer.from(value);
  const right = Buffer.from(token);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export type RequestAuth = { kind: 'master' } | { kind: 'user'; user: PublicUserAccount } | { kind: 'acp'; key: PublicAcpApiKey };

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
}

function sessionCookieValueFromHeader(header: string) {
  for (const part of header.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === AUTH_COOKIE) return decodeURIComponent(valueParts.join('='));
  }
  return undefined;
}

function sessionAuthFromCookie(request: Request): RequestAuth | null {
  const value = sessionCookieValueFromHeader(request.headers.get('cookie') || '');
  const user = verifyUserSession(value);
  if (user) return { kind: 'user', user };
  if (isValidEditToken(value)) return { kind: 'master' };
  return null;
}

export function getRequestAuth(request: Request): RequestAuth | null {
  const token = bearerToken(request);
  if (isValidEditToken(token)) return { kind: 'master' };
  const user = verifyUserSession(token);
  if (user) return { kind: 'user', user };
  const acpKey = verifyAcpApiKey(token);
  if (acpKey) return { kind: 'acp', key: acpKey };
  return sessionAuthFromCookie(request);
}

export function isAuthorizedRequest(request: Request) {
  return Boolean(getRequestAuth(request));
}

export function canRequestAuth(auth: RequestAuth | null, permission: AcpPermission) {
  if (!auth) return false;
  if (auth.kind === 'master') return true;
  if (auth.kind === 'user') return canUser(auth.user, permission);
  return canAcpKey(auth.key, permission);
}

export function hasRequestPermission(request: Request, permission: AcpPermission) {
  return canRequestAuth(getRequestAuth(request), permission);
}

export function requestActorLabel(auth: RequestAuth | null) {
  if (!auth) return 'unknown';
  if (auth.kind === 'master') return 'master-token';
  if (auth.kind === 'user') return `${auth.user.name} <${auth.user.email}>`;
  return `${auth.key.adapter}:${auth.key.name}`;
}

export function requestOwnerLabel(auth: RequestAuth | null) {
  if (!auth) return '';
  if (auth.kind === 'master') return 'Master token';
  if (auth.kind === 'user') return auth.user.email || auth.user.name;
  return auth.key.owner || auth.key.name;
}

export async function getAuthenticatedUser() {
  const jar = await cookies();
  const value = jar.get(AUTH_COOKIE)?.value;
  return verifyUserSession(value);
}

export async function isAuthenticatedCookie() {
  const jar = await cookies();
  const value = jar.get(AUTH_COOKIE)?.value;
  return Boolean(verifyUserSession(value) || isValidEditToken(value));
}

export async function setAuthCookie(token: string) {
  const jar = await cookies();
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAuthCookie() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
}
