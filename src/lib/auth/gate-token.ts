import { SignJWT, jwtVerify } from 'jose'
import { getAuthSecret } from '@/lib/auth-secret'

export const THERUM_GATE_COOKIE = 'therum_gate'

function secretKey() {
  const s = getAuthSecret()
  if (!s) {
    throw new Error('AUTH_SECRET or NEXTAUTH_SECRET must be set for gate/session signing.')
  }
  return new TextEncoder().encode(s)
}

export type GatePayload = {
  sub: string
  auth_sub: string
  role: string
}

export async function mintGateToken(payload: GatePayload): Promise<string> {
  return await new SignJWT({ auth_sub: payload.auth_sub, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secretKey())
}

export async function verifyGateToken(token: string): Promise<GatePayload> {
  const { payload } = await jwtVerify(token, secretKey(), {
    algorithms: ['HS256'],
  })
  const sub = typeof payload.sub === 'string' ? payload.sub : ''
  const auth_sub = typeof payload.auth_sub === 'string' ? payload.auth_sub : ''
  const role = typeof payload.role === 'string' ? payload.role : ''
  if (!sub || !auth_sub || !role) {
    throw new Error('Invalid gate token payload')
  }
  return { sub, auth_sub, role }
}
