/**
 * Debug API Endpoints
 * For development debugging only
 */

import { Hono } from 'hono';
import { OIDCConfig } from '../infrastructure/auth/OIDCConfig';
import { VCVerificationService } from '../infrastructure/services/VCVerificationService';

const app = new Hono();

// GET /api/debug/oidc-config - Check OIDC configuration
app.get('/oidc-config', async (c) => {
  const isDev = c.env.DEV_MODE === 'true' || c.env.NODE_ENV === 'development';
  
  if (!isDev) {
    return c.json({ error: 'Debug endpoints only available in development' }, 403);
  }

  try {
    const oidcConfig = new OIDCConfig(c.env);
    const config = oidcConfig.getConfig();
    
    return c.json({
      environment: {
        DEV_MODE: c.env.DEV_MODE,
        NODE_ENV: c.env.NODE_ENV,
        MOCK_AUTH: c.env.MOCK_AUTH,
        OIDC_ISSUER_URL: c.env.OIDC_ISSUER_URL,
        OIDC_CLIENT_ID: c.env.OIDC_CLIENT_ID ? '[SET]' : '[NOT SET]',
        OIDC_CLIENT_SECRET: c.env.OIDC_CLIENT_SECRET ? '[SET]' : '[NOT SET]',
        OIDC_REDIRECT_URI: c.env.OIDC_REDIRECT_URI
      },
      resolvedConfig: {
        issuerUrl: config.issuerUrl,
        clientId: config.clientId ? '[SET]' : '[NOT SET]',
        redirectUri: config.redirectUri,
        scopes: config.scopes
      }
    });
  } catch (error) {
    return c.json({ 
      error: 'Failed to load OIDC config',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// POST /api/debug/vc/clear-cache - Clear VC verification cache
app.post('/vc/clear-cache', async (c) => {
  const isDev = c.env.DEV_MODE === 'true' || c.env.NODE_ENV === 'development';
  
  if (!isDev) {
    return c.json({ error: 'Debug endpoints only available in development' }, 403);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const transactionId = body.transactionId;
    
    VCVerificationService.clearCache(transactionId);
    
    return c.json({
      success: true,
      message: transactionId 
        ? `Cache cleared for transaction: ${transactionId}`
        : 'All cache cleared'
    });
  } catch (error) {
    return c.json({ 
      error: 'Failed to clear cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// POST /api/debug/vc/force-check - Force VC verification check
app.post('/vc/force-check', async (c) => {
  const isDev = c.env.DEV_MODE === 'true' || c.env.NODE_ENV === 'development';
  
  if (!isDev) {
    return c.json({ error: 'Debug endpoints only available in development' }, 403);
  }

  try {
    const body = await c.req.json();
    const transactionId = body.transactionId;
    
    if (!transactionId) {
      return c.json({ error: 'transactionId is required' }, 400);
    }
    
    // Clear cache first
    VCVerificationService.clearCache(transactionId);
    
    // Force new API call
    const vcService = new VCVerificationService(c.env);
    const result = await vcService.checkVerificationStatus(transactionId);
    
    return c.json({
      success: true,
      result
    });
  } catch (error) {
    return c.json({ 
      error: 'Failed to force check',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
