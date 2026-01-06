import jwt from 'jsonwebtoken';
import { config } from './index';

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
}

export interface JWTRefreshPayload {
  userId: string;
  tokenId: string;
}

export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    issuer: 'mcp-wizard',
    audience: 'mcp-wizard-users',
  } as any);
};

export const generateRefreshToken = (payload: JWTRefreshPayload): string => {
  return jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiresIn,
    issuer: 'mcp-wizard',
    audience: 'mcp-wizard-refresh',
  } as any);
};

export const verifyAccessToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      issuer: 'mcp-wizard',
      audience: 'mcp-wizard-users',
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid access token');
  }
};

export const verifyRefreshToken = (token: string): JWTRefreshPayload => {
  try {
    const decoded = jwt.verify(token, config.jwtRefreshSecret, {
      issuer: 'mcp-wizard',
      audience: 'mcp-wizard-refresh',
    }) as JWTRefreshPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};