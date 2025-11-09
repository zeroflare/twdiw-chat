/**
 * Authentication API Endpoints
 * Handles OIDC login, callback, token refresh, and logout
 */

import { Hono } from 'hono';
import { OIDCService } from '../infrastructure/auth/OIDCService';
import { JWTService } from '../infrastructure/auth/JWTService';
import { D1MemberProfileRepository } from '../infrastructure/repositories/D1MemberProfileRepository';
import { EncryptionService } from '../infrastructure/security/EncryptionService';
import { MemberProfile } from '../domain/entities/MemberProfile';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { createLogSanitizer, LogLevel } from '../infrastructure/security/LogSanitizer';

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
    const sanitizer = createLogSanitizer(c.env);
    const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';

    // Rate limiting
    if (!checkAuthRateLimit(clientIP)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const oidcService = new OIDCService(c.env);
    const authRequest = await oidcService.createAuthorizationRequest();

    // Store OIDC state and code verifier in KV for callback verification
    const stateData = JSON.stringify({
      state: authRequest.state,
      codeVerifier: authRequest.codeVerifier
    });

    const logData = sanitizer.sanitize(LogLevel.INFO, 'Storing OIDC state in KV', {
      state: authRequest.state
    });
    if (logData.shouldLog) {
      console.log(logData.message, logData.data);
    }

    // Store with URL state as key for direct lookup
    const urlStateKey = `url_state:${authRequest.state}`;
    if (c.env.twdiw_chat_session) {
      await c.env.twdiw_chat_session.put(urlStateKey, stateData, { expirationTtl: 1200 });
      console.log('Stored in KV with URL key');
    } else {
      console.log('KV not available');
    }

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
    const sanitizer = createLogSanitizer(c.env);
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    const logData = sanitizer.sanitize(LogLevel.INFO, 'OIDC Callback received', {
      hasCode: !!code,
      hasState: !!state,
      error
    });
    if (logData.shouldLog) {
      console.log(logData.message, logData.data);
    }

    if (error) {
      const frontendUrl = c.env.FRONTEND_URL || 'https://twdiw-chat-app.pages.dev';
      return c.redirect(`${frontendUrl}/?auth=error&type=oidc_error`);
    }

    if (!code || !state) {
      const frontendUrl = c.env.FRONTEND_URL || 'https://twdiw-chat-app.pages.dev';
      return c.redirect(`${frontendUrl}/?auth=error&type=missing_params`);
    }

    // Retrieve stored PKCE data from KV using URL state parameter
    let storedData = null;

    const kvLogData = sanitizer.sanitize(LogLevel.DEBUG, 'Looking for OIDC state in KV', {
      state,
      hasKV: !!c.env.twdiw_chat_session
    });
    if (kvLogData.shouldLog) {
      console.log(kvLogData.message, kvLogData.data);
    }

    // Get stored data from KV using URL state parameter
    if (state && c.env.twdiw_chat_session) {
      const urlStateKey = `url_state:${state}`;
      storedData = await c.env.twdiw_chat_session.get(urlStateKey);
      console.log('Retrieved from KV:', { hasData: !!storedData });
    }

    console.log('Stored OIDC data:', { hasStoredData: !!storedData });

    if (!storedData) {
      const frontendUrl = c.env.FRONTEND_URL || 'https://twdiw-chat-app.pages.dev';
      return c.redirect(`${frontendUrl}/?auth=error&type=missing_state`);
    }

    // Parse stored OIDC state data
    let parsedData;
    try {
      parsedData = JSON.parse(storedData);
    } catch (parseError) {
      console.error('Failed to parse OIDC state:', parseError);
      const frontendUrl = c.env.FRONTEND_URL || 'https://twdiw-chat-app.pages.dev';
      return c.redirect(`${frontendUrl}/?auth=error&type=invalid_state_data`);
    }

    const { state: storedState, codeVerifier } = parsedData;

    // Security audit: state validation
    const stateLogData = sanitizer.sanitize(LogLevel.SECURITY, 'State validation', {
      state,
      cookieState: storedState,
      match: state === storedState
    });
    if (stateLogData.shouldLog) {
      console.log(stateLogData.message, stateLogData.data);
    }

    // Clean up KV storage
    if (state && c.env.twdiw_chat_session) {
      await c.env.twdiw_chat_session.delete(`url_state:${state}`);
    }

    const oidcService = new OIDCService(c.env);
    
    // Exchange code for tokens
    console.log('Exchanging code for tokens...');
    const tokens = await oidcService.exchangeCodeForTokens(code, codeVerifier, storedState, state);
    console.log('Token exchange successful');
    
    // Verify ID token
    console.log('Verifying ID token...');
    const claims = await oidcService.verifyIDToken(tokens.id_token);

    const claimsLogData = sanitizer.sanitize(LogLevel.INFO, 'ID token verified', {
      name: claims.name,
      email: claims.email
    });
    if (claimsLogData.shouldLog) {
      console.log(claimsLogData.message, claimsLogData.data);
    }

    // Use email as subject ID since SSO server doesn't provide standard 'sub' field
    const subjectId = claims.email || claims.sub || 'unknown';

    // Find or create member profile
    console.log('Setting up database...');
    const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
    const memberRepo = new D1MemberProfileRepository(c.env.DB, encryptionService);
    
    console.log('Looking for existing member...');
    let member = await memberRepo.findByOidcSubjectId(subjectId);

    if (!member) {
      console.log('Creating new member...');

      const memberDataLog = sanitizer.sanitize(LogLevel.DEBUG, 'Member data to create', {
        oidcSubjectId: subjectId,
        nickname: claims.name || claims.email || 'User',
        email: claims.email
      });
      if (memberDataLog.shouldLog) {
        console.log(memberDataLog.message, memberDataLog.data);
      }

      try {
        // Create new member profile
        member = MemberProfile.create({
          oidcSubjectId: subjectId,
          nickname: claims.name || claims.email || 'User',
          gender: null,
          interests: null
        });

        console.log('Member object created, attempting save...');
        await memberRepo.save(member);
        console.log('New member created successfully');
      } catch (saveError) {
        console.error('Member save error details:', saveError);
        throw saveError;
      }
    } else {
      console.log('Existing member found');
    }

    // Create session token
    console.log('Creating session token...');
    const sessionToken = await oidcService.createSessionToken(subjectId, member.getId());

    sanitizer.securityAudit('LOGIN_SUCCESS', {
      oidcSubjectId: subjectId,
      memberId: member.getId()
    });

    // Return JWT token to frontend via URL redirect
    const frontendUrl = c.env.FRONTEND_URL || 'https://twdiw-chat-app.pages.dev';
    return c.redirect(`${frontendUrl}/?auth=success&token=${sessionToken}`);

  } catch (error) {
    console.error('OIDC callback failed:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    const frontendUrl = c.env.FRONTEND_URL || 'https://twdiw-chat-app.pages.dev';
    return c.redirect(`${frontendUrl}/?auth=error&type=auth_failed`);
  }
});

// PUT /api/auth/profile - Update user profile
app.put('/profile', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const { gender, interests } = await c.req.json();

    // Validate input
    if (!gender || !interests || typeof gender !== 'string' || typeof interests !== 'string') {
      return c.json({ error: 'Invalid gender or interests' }, 400);
    }

    // Update member profile
    const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
    const memberRepo = new D1MemberProfileRepository(c.env.DB, encryptionService);
    
    const member = await memberRepo.findById(user.memberId);
    if (!member) {
      return c.json({ error: 'Member not found' }, 404);
    }

    // Update profile data
    member.updateProfile({ gender, interests });
    await memberRepo.save(member);

    return c.json({
      message: 'Profile updated successfully',
      member: {
        id: member.getId(),
        nickname: member.getNickname(),
        status: member.getStatus(),
        rank: member.getDerivedRank(),
        oidcSubjectId: member.getOidcSubjectId()
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return c.json({ error: 'Profile update failed' }, 500);
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
      sameSite: 'None', // Allow cross-domain for frontend/backend separation
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
    const member = await memberRepo.findByOidcSubjectId(user.oidcSubjectId);

    if (!member) {
      return c.json({ error: 'Member not found' }, 404);
    }

    return c.json({
      id: member.getId(),
      oidcSubjectId: user.oidcSubjectId,
      nickname: member.getNickname(),
      gender: member.getGender() || null,
      interests: member.getInterests() || null,
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
