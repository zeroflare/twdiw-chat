/**
 * Admin API Endpoints
 * Administrative functions for session management and system monitoring
 */

import { Hono } from 'hono';
import { SessionExpiryService } from '../infrastructure/services/SessionExpiryService';
import { authMiddleware } from '../middleware/auth';

const app = new Hono();

// Admin authentication middleware (simple role check)
const adminMiddleware = () => {
  return async (c: any, next: any) => {
    // In production, implement proper admin role checking
    const adminToken = c.req.header('X-Admin-Token');
    const expectedToken = c.env.ADMIN_TOKEN;

    if (!expectedToken) {
      return c.json({ error: 'Admin functionality not configured' }, 503);
    }

    if (!adminToken || adminToken !== expectedToken) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    await next();
  };
};

// Rate limiting for admin endpoints
const adminRateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkAdminRateLimit(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const key = `admin_${identifier}`;
  const current = adminRateLimitMap.get(key);

  if (!current || now > current.resetTime) {
    adminRateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

// POST /api/admin/cleanup/sessions - Manual session cleanup
app.post('/cleanup/sessions', adminMiddleware(), async (c) => {
  try {
    const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';
    
    // Rate limiting
    if (!checkAdminRateLimit(clientIP)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const sessionExpiryService = new SessionExpiryService(c.env.twdiw_chat_db, c.env.ENCRYPTION_KEY);
    
    // Perform cleanup
    const result = await sessionExpiryService.cleanupExpiredSessions();
    
    // Log admin action
    console.log('Manual session cleanup triggered by admin:', {
      clientIP,
      timestamp: new Date().toISOString(),
      result
    });

    return c.json({
      message: 'Session cleanup completed',
      result: {
        chatSessionsProcessed: result.chatSessionsProcessed,
        chatSessionsCleaned: result.chatSessionsCleaned,
        vcSessionsProcessed: result.vcSessionsProcessed,
        vcSessionsCleaned: result.vcSessionsCleaned,
        errorCount: result.errors.length
      },
      errors: result.errors.length > 0 ? result.errors : undefined
    });

  } catch (error) {
    console.error('Manual session cleanup failed:', error);
    return c.json({ error: 'Cleanup operation failed' }, 500);
  }
});

// GET /api/admin/sessions/stats - Session statistics
app.get('/sessions/stats', adminMiddleware(), async (c) => {
  try {
    const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';
    
    // Rate limiting
    if (!checkAdminRateLimit(clientIP, 20)) { // Higher limit for read operations
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const sessionExpiryService = new SessionExpiryService(c.env.twdiw_chat_db, c.env.ENCRYPTION_KEY);
    
    // Get session statistics
    const stats = await sessionExpiryService.getSessionStats();
    
    // Get expired session IDs for detailed view
    const expiredSessionIds = await sessionExpiryService.findExpiredSessions();
    
    return c.json({
      stats,
      expiredSessionIds: expiredSessionIds.slice(0, 10), // Limit to first 10 for performance
      totalExpiredSessions: expiredSessionIds.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get session stats:', error);
    return c.json({ error: 'Failed to retrieve session statistics' }, 500);
  }
});

// GET /api/admin/health - System health check
app.get('/health', adminMiddleware(), async (c) => {
  try {
    const sessionExpiryService = new SessionExpiryService(c.env.twdiw_chat_db, c.env.ENCRYPTION_KEY);
    
    // Basic health checks
    const stats = await sessionExpiryService.getSessionStats();
    
    // Check database connectivity
    const dbCheck = await c.env.twdiw_chat_db.prepare('SELECT 1 as test').first();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbCheck ? 'connected' : 'disconnected',
      sessions: {
        active: stats.totalActiveSessions,
        expired: stats.expiredSessions,
        expiringInHour: stats.expiringInHour
      },
      environment: {
        hasEncryptionKey: !!c.env.ENCRYPTION_KEY,
        hasAdminToken: !!c.env.ADMIN_TOKEN
      }
    };

    return c.json(health);

  } catch (error) {
    console.error('Health check failed:', error);
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, 500);
  }
});

export default app;
