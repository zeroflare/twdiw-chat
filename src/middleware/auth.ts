/**
 * Authentication Middleware
 * Validates JWT tokens and provides user context
 * Supports mock authentication for local development
 */

import { Context, Next } from 'hono';
import { JWTService, JWTPayload } from '../infrastructure/auth/JWTService';
import { MockAuthService } from '../infrastructure/auth/MockAuthService';
import { D1MemberProfileRepository } from '../infrastructure/repositories/D1MemberProfileRepository';
import { EncryptionService } from '../infrastructure/security/EncryptionService';
import { createLogSanitizer, LogLevel } from '../infrastructure/security/LogSanitizer';

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
    // Check for mock user ID in header only
    const mockUserId = c.req.header('X-Mock-User-Id'); // Default to LIFE_WINNER_S user
    
    if (!mockUserId) {
      console.log('[MockAuth] No mock user ID provided, authentication required');
      return c.json({ error: 'Mock user ID required in development mode' }, 401);
    }
    console.log('[MockAuth] Mock user ID:', mockUserId);
    
    const mockAuthService = new MockAuthService(c.env.JWT_SECRET);
    const mockUser = mockAuthService.getMockUser(mockUserId);
    console.log('[MockAuth] Mock user found:', !!mockUser, mockUser?.oidcSubjectId);
    
    if (!mockUser) {
      console.log('[MockAuth] Mock user not found for ID:', mockUserId);
      return c.json({ error: 'Mock user not found' }, 401);
    }

    // Find actual member in database by OIDC subject ID
    const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
    const memberRepo = new D1MemberProfileRepository(c.env.twdiw_chat_db, encryptionService);
    console.log('[MockAuth] Looking for member with OIDC subject:', mockUser.oidcSubjectId);
    const member = await memberRepo.findByOidcSubjectId(mockUser.oidcSubjectId);
    console.log('[MockAuth] Member found in database:', !!member, member?.getId());
    
    if (!member) {
      console.log('[MockAuth] Member not found in database for OIDC subject:', mockUser.oidcSubjectId);
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
    // Extract token from Authorization header only
    const authHeader = c.req.header('Authorization');
    
    let token: string | undefined;
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Verify token
    const payload = await jwtService.verify(token);

    // Get member from database to ensure we have latest rank info
    const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
    const memberRepo = new D1MemberProfileRepository(c.env.twdiw_chat_db, encryptionService);
    const member = await memberRepo.findByOidcSubjectId(payload.sub);

    const sanitizer = createLogSanitizer(c.env);
    const logData = sanitizer.sanitize(LogLevel.DEBUG, '[Auth Middleware] JWT auth result', {
      payloadSub: payload.sub,
      memberFound: !!member,
      memberRank: member?.getDerivedRank(),
      memberStatus: member?.getStatus()
    });
    if (logData.shouldLog) {
      console.log(logData.message, logData.data);
    }
    
    // Add user context
    c.set('user', {
      oidcSubjectId: payload.sub,
      memberId: payload.memberId,
      rank: member?.getDerivedRank() || null
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
        const mockUserId = c.req.header('X-Mock-User-Id');
    
    if (!mockUserId) {
      console.log('[MockAuth] No mock user ID provided, authentication required');
      return c.json({ error: 'Mock user ID required in development mode' }, 401);
    }
        if (mockUserId) {
          const mockAuthService = new MockAuthService(c.env.JWT_SECRET);
          const mockUser = mockAuthService.getMockUser(mockUserId);
          if (mockUser) {
            // Find actual member in database by OIDC subject ID (consistent with handleMockAuth)
            const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
            const memberRepo = new D1MemberProfileRepository(c.env.twdiw_chat_db, encryptionService);
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
        
        let token: string | undefined;
        
        if (authHeader?.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }

        if (token) {
          const payload = await jwtService.verify(token);
          
          // Get member from database to ensure we have latest rank info
          const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
          const memberRepo = new D1MemberProfileRepository(c.env.twdiw_chat_db, encryptionService);
          const member = await memberRepo.findByOidcSubjectId(payload.sub);
          
          c.set('user', {
            oidcSubjectId: payload.sub,
            memberId: payload.memberId,
            rank: member?.getDerivedRank() || null
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
