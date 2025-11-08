/**
 * Authentication Middleware
 * Validates JWT tokens and provides user context
 */

import { Context, Next } from 'hono';
import { JWTService, JWTPayload } from '../infrastructure/auth/JWTService';

export interface AuthContext {
  user: {
    oidcSubjectId: string;
    memberId: string;
  };
}

export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const jwtService = new JWTService(c.env.JWT_SECRET);
    
    try {
      // Extract token from Authorization header or cookie
      const authHeader = c.req.header('Authorization');
      const cookieToken = c.req.cookie('session');
      
      let token: string | undefined;
      
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (cookieToken) {
        token = cookieToken;
      }

      if (!token) {
        return c.json({ error: 'Authentication required' }, 401);
      }

      // Verify token
      const payload = await jwtService.verify(token);
      
      // Add user context
      c.set('user', {
        oidcSubjectId: payload.sub,
        memberId: payload.memberId
      });

      await next();
    } catch (error) {
      console.error('Authentication failed:', error);
      return c.json({ error: 'Invalid or expired token' }, 401);
    }
  };
}

export function optionalAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const jwtService = new JWTService(c.env.JWT_SECRET);
    
    try {
      const authHeader = c.req.header('Authorization');
      const cookieToken = c.req.cookie('session');
      
      let token: string | undefined;
      
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (cookieToken) {
        token = cookieToken;
      }

      if (token) {
        const payload = await jwtService.verify(token);
        c.set('user', {
          oidcSubjectId: payload.sub,
          memberId: payload.memberId
        });
      }
    } catch (error) {
      // Optional auth - continue without user context
      console.warn('Optional auth failed:', error);
    }

    await next();
  };
}
