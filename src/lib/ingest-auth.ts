import crypto from 'node:crypto';

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function isHermesIngestAuthorized(request: Request) {
  const token = process.env.HERMES_INGEST_TOKEN || '';
  if (!token) return process.env.NODE_ENV !== 'production';
  const header = request.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  return Boolean(bearer) && timingSafeEqual(bearer, token);
}

export function missingHermesTokenMessage() {
  return process.env.HERMES_INGEST_TOKEN ? 'Unauthorized Hermes ingestion request.' : 'HERMES_INGEST_TOKEN is required in production.';
}
