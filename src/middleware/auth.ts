/**
 * Authentication Middleware
 * Validates JWT tokens and provides user context
 * Supports mock authentication for local development
 */

import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { JWTService, JWTPayload } from '../infrastructure/auth/JWTService';
import { MockAuthService } from '../infrastructure/auth/MockAuthService';
import { D1MemberProfileRepository } from '../infrastructure/repositories/D1MemberProfileRepository';
import { EncryptionService } from '../infrastructure/security/EncryptionService';

export interface AuthContext {
  user: {
    oidcSubjectId: string;
    memberId: string;
  };
}

export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const isDev = c.env.DEV_MODE === 'true' || c.env.NODE_ENV === 'development';
    const useMockAuth = c.env.MOCK_AUTH === 'true';
    
    if (isDev && useMockAuth) {
      // Development mode: use mock authentication
      return handleMockAuth(c, next);
    } else {
      // Production mode: use real JWT authentication
      return handleJWTAuth(c, next);
    }
  };
}

async function handleMockAuth(c: Context, next: Next) {
  try {
    // Check for mock user ID in header or cookie
    const mockUserId = c.req.header('X-Mock-User-Id') || getCookie(c, 'mock-user-id') || 'user-2'; // Default to LIFE_WINNER_S user
    
    const mockAuthService = new MockAuthService(c.env.JWT_SECRET);
    const mockUser = mockAuthService.getMockUser(mockUserId);
    
    if (!mockUser) {
      return c.json({ error: 'Mock user not found' }, 401);
    }

    // Find actual member in database by OIDC subject ID
    const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
    const memberRepo = new D1MemberProfileRepository(c.env.DB, encryptionService);
    const member = await memberRepo.findByOidcSubjectId(mockUser.oidcSubjectId);
    
    if (!member) {
      return c.json({ error: 'Member not found in database' }, 404);
    }

    // Add user context with actual database ID and rank
    c.set('user', {
      oidcSubjectId: mockUser.oidcSubjectId,
      memberId: member.getId(),
      rank: member.getDerivedRank()
    });

    await next();
  } catch (error) {
    console.error('Mock authentication failed:', error);
    return c.json({ error: 'Mock authentication failed' }, 401);
  }
}

async function handleJWTAuth(c: Context, next: Next) {
  const jwtService = new JWTService(c.env.JWT_SECRET);
  
  try {
    // Extract token from Authorization header or cookie
    const authHeader = c.req.header('Authorization');
    const cookieToken = getCookie(c, 'session');
    
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
    
    // Get member from database to ensure we have latest rank info
    const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
    const memberRepo = new D1MemberProfileRepository(c.env.DB, encryptionService);
    const member = await memberRepo.findByOidcSubjectId(payload.sub);
    
    // Add user context
    c.set('user', {
      oidcSubjectId: payload.sub,
      memberId: payload.memberId,
      rank: member?.getDerivedRank()
    });

    await next();
  } catch (error) {
    console.error('Authentication failed:', error);
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

export function optionalAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const isDev = c.env.DEV_MODE === 'true' || c.env.NODE_ENV === 'development';
    const useMockAuth = c.env.MOCK_AUTH === 'true';
    
    try {
      if (isDev && useMockAuth) {
        // Development mode: use mock authentication
        const mockUserId = c.req.header('X-Mock-User-Id') || getCookie(c, 'mock-user-id');
        if (mockUserId) {
          const mockAuthService = new MockAuthService(c.env.JWT_SECRET);
          const mockUser = mockAuthService.getMockUser(mockUserId);
          if (mockUser) {
            // Find actual member in database by OIDC subject ID (consistent with handleMockAuth)
            const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
            const memberRepo = new D1MemberProfileRepository(c.env.DB, encryptionService);
            const member = await memberRepo.findByOidcSubjectId(mockUser.oidcSubjectId);
            
            if (member) {
              c.set('user', {
                oidcSubjectId: mockUser.oidcSubjectId,
                memberId: member.getId(), // Use actual database ID
                rank: member.getDerivedRank()
              });
            }
          }
        }
      } else {
        // Production mode: use real JWT authentication
        const jwtService = new JWTService(c.env.JWT_SECRET);
        const authHeader = c.req.header('Authorization');
        const cookieToken = getCookie(c, 'session');
        
        let token: string | undefined;
        
        if (authHeader?.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        } else if (cookieToken) {
          token = cookieToken;
        }

        if (token) {
          const payload = await jwtService.verify(token);
          
          // Get member from database to ensure we have latest rank info
          const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
          const memberRepo = new D1MemberProfileRepository(c.env.DB, encryptionService);
          const member = await memberRepo.findByOidcSubjectId(payload.sub);
          
          c.set('user', {
            oidcSubjectId: payload.sub,
            memberId: payload.memberId,
            rank: member?.getDerivedRank()
          });
        }
      }
    } catch (error) {
      // Optional auth - continue without user context
      console.warn('Optional auth failed:', error);
    }

    await next();
  };
}
