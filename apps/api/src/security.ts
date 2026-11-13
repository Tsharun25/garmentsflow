import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export function signToken(tenantId: string, secret: string) {
  const payload = `${tenantId}.${randomBytes(32).toString('hex')}`;
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('hex')}`;
}
export function tokenTenant(token: string, secret: string): string | null {
  const parts = token.split('.');
  if (
    parts.length !== 3 ||
    !z.uuid().safeParse(parts[0]).success ||
    !/^[a-f0-9]{64}$/.test(parts[1]) ||
    !/^[a-f0-9]{64}$/.test(parts[2])
  )
    return null;
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  return timingSafeEqual(expected, Buffer.from(parts[2], 'hex')) ? parts[0] : null;
}
export const csrfToken = (token: string, secret: string) =>
  createHmac('sha256', secret).update(`csrf:${token}`).digest('hex');
export function readCookie(header: string | undefined, name: string) {
  return (
    header
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ''
  );
}
