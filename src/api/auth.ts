/**
 * Authentication API Endpoints
 * Handles OIDC login, callback, token refresh, and logout
 */

import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { OIDCService } from '../infrastructure/auth/OIDCService';
import { JWTService } from '../infrastructure/auth/JWTService';
import { D1MemberProfileRepository } from '../infrastructure/repositories/D1MemberProfileRepository';
import { EncryptionService } from '../infrastructure/security/EncryptionService';
import { MemberProfile } from '../domain/entities/MemberProfile';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const app = new Hono();

// Rate limiting for auth endpoints
const authRateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkAuthRateLimit(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const key = `auth_${identifier}`;
  const current = authRateLimitMap.get(key);

  if (!current || now > current.resetTime) {
    authRateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

// GET /api/auth/login - Initiate OIDC login
app.get('/login', async (c) => {
  try {
    const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';
    
    // Rate limiting
    if (!checkAuthRateLimit(clientIP)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const oidcService = new OIDCService(c.env);
    const authRequest = await oidcService.createAuthorizationRequest();

    // Store PKCE verifier and state in secure cookie (short-lived)
    setCookie(c, 'oidc_state', JSON.stringify({
      state: authRequest.state,
      codeVerifier: authRequest.codeVerifier
    }), {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 600, // 10 minutes
      path: '/api/auth'
    });

    return c.json({
      authUrl: authRequest.authUrl,
      message: 'Redirect to authUrl to complete login'
    });

  } catch (error) {
    console.error('Login initiation failed:', error);
    return c.json({ error: 'Failed to initiate login' }, 500);
  }
});

// GET /api/auth/callback - OIDC callback handler
app.get('/callback', async (c) => {
  try {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    console.log('OIDC Callback received:', { code: !!code, state: !!state, error });

    if (error) {
      return c.json({ error: `OIDC error: ${error}` }, 400);
    }

    if (!code || !state) {
      return c.json({ error: 'Missing authorization code or state' }, 400);
    }

    // Retrieve stored PKCE data
    const storedData = getCookie(c, 'oidc_state');
    console.log('Stored OIDC data:', { hasStoredData: !!storedData });
    
    if (!storedData) {
      return c.json({ error: 'Missing OIDC state data' }, 400);
    }

    let parsedData;
    try {
      parsedData = JSON.parse(storedData);
    } catch (parseError) {
      console.error('Failed to parse OIDC state:', parseError);
      return c.json({ error: 'Invalid OIDC state data' }, 400);
    }

    const { state: storedState, codeVerifier } = parsedData;

    // Clear the temporary cookie
    deleteCookie(c, 'oidc_state', { path: '/api/auth' });

    const oidcService = new OIDCService(c.env);
    
    // Exchange code for tokens
    console.log('Exchanging code for tokens...');
    const tokens = await oidcService.exchangeCodeForTokens(code, codeVerifier, storedState, state);
    console.log('Token exchange successful');
    
    // Verify ID token
    console.log('Verifying ID token...');
    const claims = await oidcService.verifyIDToken(tokens.id_token);
    console.log('ID token verified, claims:', { sub: claims.sub, name: claims.name });

    // Find or create member profile
    console.log('Setting up database...');
    const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
    const memberRepo = new D1MemberProfileRepository(c.env.DB, encryptionService);
    
    console.log('Looking for existing member...');
    let member = await memberRepo.findByOidcSubjectId(claims.sub);

    if (!member) {
      console.log('Creating new member...');
      // Create new member profile
      member = MemberProfile.create({
        oidcSubjectId: claims.sub,
        nickname: claims.name || claims.email || 'User',
        gender: 'Unknown',
        interests: ''
      });
      await memberRepo.save(member);
      console.log('New member created');
    } else {
      console.log('Existing member found');
    }

    // Create session token
    console.log('Creating session token...');
    const sessionToken = await oidcService.createSessionToken(claims.sub, member.getId());

    // Set secure session cookie
    setCookie(c, 'session', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      maxAge: 3600, // 1 hour
      path: '/'
    });

    console.log('Login successful for user:', claims.sub);
    return c.json({
      message: 'Login successful',
      member: {
        id: member.getId(),
        nickname: member.getNickname(),
        status: member.getStatus(),
        rank: member.getDerivedRank()
      }
    });

  } catch (error) {
    console.error('OIDC callback failed:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return c.json({ 
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// POST /api/auth/refresh - Refresh JWT token
app.post('/refresh', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';
    
    // Rate limiting
    if (!checkAuthRateLimit(`${user.memberId}_${clientIP}`, 5)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    // Verify member still exists
    const memberRepo = new D1MemberProfileRepository(c.env.DB, c.env.ENCRYPTION_KEY);
    const member = await memberRepo.findById(user.memberId);

    if (!member) {
      return c.json({ error: 'Member not found' }, 404);
    }

    // Create new session token
    const jwtService = new JWTService(c.env.JWT_SECRET);
    const newToken = await jwtService.sign({
      sub: user.oidcSubjectId,
      memberId: user.memberId
    }, 3600); // 1 hour

    // Update session cookie
    setCookie(c, 'session', newToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      maxAge: 3600,
      path: '/'
    });

    return c.json({
      message: 'Token refreshed successfully',
      expiresIn: 3600
    });

  } catch (error) {
    console.error('Token refresh failed:', error);
    return c.json({ error: 'Failed to refresh token' }, 500);
  }
});

// POST /api/auth/logout - Logout and clear session
app.post('/logout', optionalAuthMiddleware(), async (c) => {
  try {
    // Clear session cookie
    deleteCookie(c, 'session', { path: '/' });

    return c.json({
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout failed:', error);
    return c.json({ error: 'Logout failed' }, 500);
  }
});

// GET /api/auth/me - Get current user info
app.get('/me', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');

    // Get fresh member data
    const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
    const memberRepo = new D1MemberProfileRepository(c.env.DB, encryptionService);
    const member = await memberRepo.findById(user.memberId);

    if (!member) {
      return c.json({ error: 'Member not found' }, 404);
    }

    return c.json({
      id: member.getId(),
      oidcSubjectId: user.oidcSubjectId,
      nickname: member.getNickname(),
      status: member.getStatus(),
      rank: member.getDerivedRank(),
      linkedVcDid: member.getLinkedVcDid()
    });

  } catch (error) {
    console.error('Get user info failed:', error);
    return c.json({ error: 'Failed to get user information' }, 500);
  }
});

export default app;
