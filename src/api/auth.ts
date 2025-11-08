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
import { CookieSigningService } from '../infrastructure/security/CookieSigningService';
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

    // Sign OIDC state cookie for integrity protection
    const cookieSigner = new CookieSigningService(c.env.COOKIE_SIGNING_KEY);
    const cookieValue = JSON.stringify({
      state: authRequest.state,
      codeVerifier: authRequest.codeVerifier
    });
    const signedValue = await cookieSigner.sign(cookieValue);

    // Store in both cookie AND KV as fallback
    const sessionId = crypto.randomUUID();
    
    console.log('Setting cookies:', {
      sessionId,
      signedValueLength: signedValue.length,
      cookieValue: signedValue.substring(0, 50) + '...'
    });
    
    // Store signed PKCE verifier and state in secure cookie (short-lived)
    setCookie(c, 'oidc_state', signedValue, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 1200, // 20 minutes
      path: '/',
      domain: undefined
    });
    
    // Fallback: Store in KV with session ID in cookie
    setCookie(c, 'oidc_session', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 1200,
      path: '/'
    });
    
    // Store state data in KV with URL-accessible key (ultimate fallback)
    const urlStateKey = `url_state:${authRequest.state}`;
    if (c.env.KV) {
      await c.env.KV.put(urlStateKey, signedValue, { expirationTtl: 1200 });
      console.log('Stored in KV with URL key:', urlStateKey);
    } else {
      console.log('KV not available');
    }

    return c.json({
      authUrl: authRequest.authUrl,
      message: 'Redirect to authUrl to complete login',
      // Debug: Include state for verification
      debugState: authRequest.state
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
      const frontendUrl = c.env.FRONTEND_URL || 'https://twdiw-chat-app.pages.dev';
      return c.redirect(`${frontendUrl}/?auth=error&type=oidc_error`);
    }

    if (!code || !state) {
      const frontendUrl = c.env.FRONTEND_URL || 'https://twdiw-chat-app.pages.dev';
      return c.redirect(`${frontendUrl}/?auth=error&type=missing_params`);
    }

    // Retrieve stored PKCE data with KV fallback
    let storedData = getCookie(c, 'oidc_state');
    const sessionId = getCookie(c, 'oidc_session');
    
    console.log('Cookie check:', { 
      hasOidcState: !!storedData, 
      hasSessionId: !!sessionId,
      sessionId: sessionId,
      hasKV: !!c.env.KV
    });
    
    // Fallback: Try KV if cookie is missing
    if (!storedData && sessionId && c.env.KV) {
      storedData = await c.env.KV.get(`oidc_state:${sessionId}`);
      console.log('Retrieved from KV fallback:', { 
        hasData: !!storedData,
        kvKey: `oidc_state:${sessionId}`
      });
    }
    
    // Ultimate fallback: Use URL state parameter to lookup in KV
    if (!storedData && state && c.env.KV) {
      const urlStateKey = `url_state:${state}`;
      storedData = await c.env.KV.get(urlStateKey);
      console.log('Retrieved from URL state fallback:', { 
        hasData: !!storedData,
        kvKey: urlStateKey
      });
    }
    
    console.log('Stored OIDC data:', { hasStoredData: !!storedData });

    if (!storedData) {
      const frontendUrl = c.env.FRONTEND_URL || 'https://twdiw-chat-app.pages.dev';
      return c.redirect(`${frontendUrl}/?auth=error&type=missing_state`);
    }

    // Verify HMAC signature for integrity protection
    const cookieSigner = new CookieSigningService(c.env.COOKIE_SIGNING_KEY);
    const verifyResult = await cookieSigner.verify(storedData);

    if (!verifyResult.valid || !verifyResult.value) {
      console.error('OIDC state signature verification failed');
      const frontendUrl = c.env.FRONTEND_URL || 'https://twdiw-chat-app.pages.dev';
      return c.redirect(`${frontendUrl}/?auth=error&type=invalid_signature`);
    }

    let parsedData;
    try {
      parsedData = JSON.parse(verifyResult.value);
    } catch (parseError) {
      console.error('Failed to parse OIDC state:', parseError);
      const frontendUrl = c.env.FRONTEND_URL || 'https://twdiw-chat-app.pages.dev';
      return c.redirect(`${frontendUrl}/?auth=error&type=invalid_state_data`);
    }

    const { state: storedState, codeVerifier } = parsedData;

    // Debug: Log state comparison
    console.log('State comparison:', { 
      urlState: state, 
      cookieState: storedState, 
      match: state === storedState 
    });

    // Clear the temporary cookies and KV
    deleteCookie(c, 'oidc_state', { path: '/' });
    deleteCookie(c, 'oidc_session', { path: '/' });
    
    // Clean up KV if used (reuse sessionId from above)
    if (sessionId && c.env.KV) {
      await c.env.KV.delete(`oidc_state:${sessionId}`);
    }
    
    // Clean up URL-based KV entry
    if (state && c.env.KV) {
      await c.env.KV.delete(`url_state:${state}`);
    }

    const oidcService = new OIDCService(c.env);
    
    // Exchange code for tokens
    console.log('Exchanging code for tokens...');
    const tokens = await oidcService.exchangeCodeForTokens(code, codeVerifier, storedState, state);
    console.log('Token exchange successful');
    
    // Verify ID token
    console.log('Verifying ID token...');
    const claims = await oidcService.verifyIDToken(tokens.id_token);
    console.log('ID token verified, claims:', { name: claims.name, email: claims.email });

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
      console.log('Member data to create:', {
        oidcSubjectId: subjectId,
        nickname: claims.name || claims.email || 'User',
        email: claims.email
      });
      
      try {
        // Create new member profile
        member = MemberProfile.create({
          oidcSubjectId: subjectId,
          nickname: claims.name || claims.email || 'User',
          gender: 'Unknown',
          interests: ''
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

    // Set secure session cookie
    setCookie(c, 'session', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'None', // Allow cross-domain for frontend/backend separation
      maxAge: 3600, // 1 hour
      path: '/'
    });

    console.log('Login successful for user:', subjectId);

    // Return JWT token to frontend instead of setting cookie
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
