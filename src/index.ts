/**
 * Main entry point for twdiw-chat Cloudflare Worker
 * Integrates all API routes and handles scheduled events
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Import API routes
import authRoutes from './api/auth';
import forumsRoutes from './api/forums';
import vcVerificationRoutes from './api/vc-verification';
import chatRoutes from './api/chat';
import adminRoutes from './api/admin';
import devRoutes from './api/dev';

// Import scheduled worker
import sessionCleanup from './scheduled/session-cleanup';

// Create main app
const app = new Hono();

// CORS middleware
app.use('*', cors({
  origin: [
    'http://localhost:3000',
    'https://twdiw-chat.pages.dev',
    /^https:\/\/.*\.twdiw-chat\.pages\.dev$/
  ],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// API health check endpoint (moved to /api to avoid conflict with frontend)
app.get('/api', (c) => {
  const isDev = c.env.DEV_MODE === 'true' || c.env.NODE_ENV === 'development';
  
  return c.json({
    message: '三人行必有我師論壇 API',
    version: '1.0.0',
    mode: isDev ? 'development' : 'production',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth/*',
      forums: '/api/forums/*',
      vcVerification: '/api/vc/verify/*',
      chat: '/api/chat/*',
      admin: '/api/admin/*',
      ...(isDev && { dev: '/api/dev/*' })
    }
  });
});

// Mount API routes
app.route('/api/auth', authRoutes);
app.route('/api/forums', forumsRoutes);
app.route('/api/vc/verify', vcVerificationRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/dev', devRoutes);

// Catch-all route - return 404 for any non-API routes
// Frontend is served separately via Cloudflare Pages
app.get('*', (c) => {
  return c.json({
    error: 'Not Found',
    message: 'This is the API backend. Frontend is served separately via Cloudflare Pages.'
  }, 404);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// Export for Cloudflare Workers
export default {
  async fetch(request: Request, env: any, ctx: any) {
    return app.fetch(request, env, ctx);
  },
  scheduled: sessionCleanup.scheduled,
};
