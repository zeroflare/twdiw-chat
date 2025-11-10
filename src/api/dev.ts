/**
 * Development API Endpoints
 * Mock authentication and testing utilities for local development
 */

import { Hono } from 'hono';
import { Rank, MemberProfile } from '../domain/entities/MemberProfile';
import { EncryptedPersonalInfo } from '../domain/value-objects/EncryptedPersonalInfo';
import { setCookie } from 'hono/cookie';
import { MockAuthService } from '../infrastructure/auth/MockAuthService';
import { D1MemberProfileRepository } from '../infrastructure/repositories/D1MemberProfileRepository';
import { EncryptionService } from '../infrastructure/security/EncryptionService';

const app = new Hono();

// Only enable in development mode
const devModeMiddleware = () => {
  return async (c: any, next: any) => {
    const isDev = c.env.DEV_MODE === 'true' || c.env.NODE_ENV === 'development';
    if (!isDev) {
      return c.json({ error: 'Development endpoints not available in production' }, 404);
    }
    await next();
  };
};

app.use('*', devModeMiddleware());

// GET /api/dev/users - List mock users
app.get('/users', async (c) => {
  const mockAuthService = new MockAuthService(c.env.JWT_SECRET);
  const users = mockAuthService.getMockUsers();
  
  return c.json({
    message: 'Available mock users for testing',
    users: users.map(user => ({
      id: user.id,
      nickname: user.nickname,
      status: user.status,
      rank: user.rank
    }))
  });
});

// POST /api/dev/login/:userId - Mock login
app.post('/login/:userId', async (c) => {
  const userId = c.req.param('userId');
  const mockAuthService = new MockAuthService(c.env.JWT_SECRET);
  
  try {
    const user = mockAuthService.getMockUser(userId);
    if (!user) {
      return c.json({ error: 'Mock user not found' }, 404);
    }

    // Create or update member profile in database
    const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
    const memberRepo = new D1MemberProfileRepository(c.env.twdiw_chat_db, encryptionService);
    let member = await memberRepo.findByOidcSubjectId(user.oidcSubjectId);
    
    if (!member) {
      // Create new member profile
      member = MemberProfile.create({
        oidcSubjectId: user.oidcSubjectId,
        nickname: user.nickname,
        gender: 'Unknown',
        interests: ''
      });
      
      // If mock user is verified, update the profile
      if (user.status === 'VERIFIED' && user.rank && user.linkedVcDid) {
        member.verifyWithRankCard(user.linkedVcDid, user.rank as any);
      }
      
      await memberRepo.save(member);
    }

    // Create session token
    const sessionToken = await mockAuthService.createMockSession(userId);
    
    // Set cookie for browser
    setCookie(c, 'session', sessionToken, {
      httpOnly: true,
      secure: false, // Allow HTTP in development
      sameSite: 'Lax',
      maxAge: 24 * 3600, // 24 hours
      path: '/'
    });

    // Also set mock user ID cookie for middleware
    setCookie(c, 'mock-user-id', userId, {
      httpOnly: false, // Allow JS access for testing
      secure: false,
      sameSite: 'Lax', 
      maxAge: 24 * 3600,
      path: '/'
    });

    return c.json({
      message: 'Mock login successful',
      user: {
        id: member.getId(),
        nickname: member.getNickname(),
        status: member.getStatus(),
        rank: member.getDerivedRank()
      },
      sessionToken
    });

  } catch (error) {
    console.error('Mock login failed:', error);
    return c.json({ error: 'Mock login failed' }, 500);
  }
});

// POST /api/dev/vc/mock-verify - Mock VC verification
app.post('/vc/mock-verify', async (c) => {
  try {
    const { rank = Rank.EARTH_OL_GRADUATE } = await c.req.json();
    const mockAuthService = new MockAuthService(c.env.JWT_SECRET);
    
    // Generate mock verification
    const verification = mockAuthService.mockVCVerification('dev-user', rank);
    
    return c.json(verification);
  } catch (error) {
    return c.json({ error: 'Mock VC verification failed' }, 500);
  }
});

// GET /api/dev/vc/mock-complete/:transactionId - Complete mock VC verification
app.get('/vc/mock-complete/:transactionId', async (c) => {
  try {
    const transactionId = c.req.param('transactionId');
    const rank = c.req.query('rank') || Rank.EARTH_OL_GRADUATE;
    
    const mockAuthService = new MockAuthService(c.env.JWT_SECRET);
    const result = mockAuthService.completeMockVCVerification(
      transactionId, 
      rank as Rank
    );
    
    return c.json(result);
  } catch (error) {
    return c.json({ error: 'Mock VC completion failed' }, 500);
  }
});

// POST /api/dev/seed-data - Seed test data
app.post('/seed-data', async (c) => {
  try {
    const mockAuthService = new MockAuthService(c.env.JWT_SECRET);
    const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
    const memberRepo = new D1MemberProfileRepository(c.env.twdiw_chat_db, encryptionService);
    
    const users = mockAuthService.getMockUsers();
    const results = [];
    
    for (const user of users) {
      // Check if user already exists
      const existing = await memberRepo.findByOidcSubjectId(user.oidcSubjectId);
      
      if (existing) {
        results.push({ user: user.nickname, status: 'already exists', id: existing.getId() });
        continue;
      }
      
      // Create member profile
      const member = MemberProfile.create({
        oidcSubjectId: user.oidcSubjectId,
        nickname: user.nickname,
        gender: 'Unknown',
        interests: ''
      });
      
      // If verified user, add VC data
      if (user.status === 'VERIFIED' && user.rank && user.linkedVcDid) {
        member.verifyWithRankCard(user.linkedVcDid, user.rank as any);
      }
      
      await memberRepo.save(member);
      results.push({ user: user.nickname, status: 'created', id: member.getId() });
    }
    
    return c.json({
      message: 'Test data seeded successfully',
      results
    });
    
  } catch (error) {
    console.error('Seed data failed:', error);
    return c.json({ error: 'Failed to seed test data' }, 500);
  }
});

// POST /api/dev/vc/complete/:transactionId - Complete mock VC verification
app.post('/vc/complete/:transactionId', async (c) => {
  try {
    const transactionId = c.req.param('transactionId');
    const { rank = Rank.EARTH_OL_GRADUATE } = await c.req.json();
    
    // Update verification session to completed
    const sessionStore = new (await import('../infrastructure/services/VCVerificationSessionStore')).VCVerificationSessionStore(c.env.twdiw_chat_db);
    
    await sessionStore.updateSession(transactionId, {
      status: 'completed',
      extractedDid: `did:example:${rank.toLowerCase()}-member`,
      extractedRank: rank,
      completedAt: Date.now()
    });
    
    return c.json({
      message: 'Mock VC verification completed',
      transactionId,
      status: 'completed',
      extractedClaims: {
        did: `did:example:${rank.toLowerCase()}-member`,
        rank: rank
      }
    });
  } catch (error) {
    console.error('Mock VC completion failed:', error);
    return c.json({ error: 'Mock VC completion failed' }, 500);
  }
});

export default app;

// POST /api/dev/create-test-user - Create test user with proper encryption
app.post('/create-test-user', async (c) => {
  try {
    const { email, name, nickname } = await c.req.json();
    console.log('[create-test-user] Received data:', { email, name, nickname });
    
    if (!email || !name || !nickname) {
      return c.json({ error: 'email, name, and nickname are required' }, 400);
    }

    const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
    const memberRepo = new D1MemberProfileRepository(c.env.twdiw_chat_db, encryptionService);
    
    // Check if user already exists
    const existingMember = await memberRepo.findByOidcSubjectId(email);
    if (existingMember) {
      return c.json({ 
        message: 'User already exists',
        userId: existingMember.getId(),
        email: email,
        nickname: existingMember.getNickname()
      });
    }

    // Generate unique user ID
    const userId = `test-user-${Date.now()}`;
    
    // Create member profile with proper encryption
    const member = MemberProfile.create({
      oidcSubjectId: email,
      nickname: nickname,
      gender: null,
      interests: null
    });

    await memberRepo.save(member);

    return c.json({
      message: 'Test user created successfully',
      userId: userId,
      email: email,
      nickname: nickname,
      name: name,
      status: 'GENERAL'
    });

  } catch (error) {
    console.error('Create test user failed:', error);
    return c.json({ error: 'Failed to create test user' }, 500);
  }
});
