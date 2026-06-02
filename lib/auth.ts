import jwt from 'jsonwebtoken'

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

export interface JWTPayload {
  userId: number
  email: string
  tokenVersion?: number
}

export function generateToken(payload: JWTPayload, expiresIn: jwt.SignOptions['expiresIn'] = '7d'): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload
  } catch (error) {
    return null
  }
}
