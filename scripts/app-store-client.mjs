import { sign } from 'node:crypto';

// CI-only client. Credentials and signed upload URLs must never enter logs or artifacts.
export async function asc(path, method = 'GET', data) {
  if (!path.startsWith('/v1/') && !path.startsWith('/v2/')) throw Error('Unexpected ASC path');
  const keyId = process.env.APP_STORE_CONNECT_KEY_ID, issuer = process.env.APP_STORE_CONNECT_ISSUER_ID;
  const encoded = process.env.APP_STORE_CONNECT_API_KEY_BASE64;
  if (!keyId || !issuer || !encoded) throw Error('Missing App Store Connect credentials');
  const key = encoded.includes('BEGIN PRIVATE KEY') ? encoded : Buffer.from(encoded.replace(/\s/g, ''), 'base64').toString('utf8');
  const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = `${b64({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.${b64({ iss: issuer, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })}`;
  const token = payload + '.' + sign('sha256', Buffer.from(payload), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  const response = await fetch('https://api.appstoreconnect.apple.com' + path, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify({ data }), signal: AbortSignal.timeout(60000),
  });
  const body = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw Error(`ASC ${method} ${path}: ${response.status} ${body.errors?.map(e => e.detail || e.title).join('; ')}`);
  return body;
}

export function sanitized(value) {
  return JSON.parse(JSON.stringify(value, (key, v) => key === 'uploadOperations' ? undefined : v));
}
