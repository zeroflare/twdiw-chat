import { Hono } from 'hono';

import authRoutes from './api/auth';
import vcRoutes from './api/vc-verification';
import forumsRoutes from './api/forums';
import chatRoutes from './api/chat';
import devRoutes from './api/dev';
import debugRoutes from './api/debug';
import * as sessionCleanup from './scheduled/session-cleanup';

const app = new Hono<{ Bindings: CloudflareBindings }>();

import adminRoutes from './api/admin';

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/vc', vcRoutes);
app.route('/api/forums', forumsRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/dev', devRoutes);
app.route('/api/debug', debugRoutes);
app.route('/api/admin', adminRoutes);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static assets using the ASSETS binding
// The Assets binding automatically handles SPA routing (404 -> index.html)
app.get('*', (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
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
  scheduled: sessionCleanup.default.scheduled,
};
