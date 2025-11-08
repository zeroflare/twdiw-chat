import { Hono } from 'hono';
import { cors } from 'hono/cors';

import authRoutes from './api/auth';
import forumsRoutes from './api/forums';
import vcRoutes from './api/vc';
import chatRoutes from './api/chat';
import adminRoutes from './api/admin';
import devRoutes from './api/dev';
import sessionCleanup from './scheduled/sessionCleanup';

const app = new Hono();

// CORS configuration
app.use('*', cors({
  origin: (origin) => {
    // Allow requests from the same domain and localhost for development
    if (!origin || origin.includes('workers.dev') || origin.includes('localhost')) {
      return origin;
    }
    return null;
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// API health check endpoint
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
app.route('/api/vc', vcRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/dev', devRoutes);

// SPA routing - serve index.html for non-API and non-asset routes
app.get('*', (c) => {
  // If it's an API route, let it fall through to 404
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not Found' }, 404);
  }
  
  // If it's an assets route, let Cloudflare Workers Site handle it
  if (c.req.path.startsWith('/assets/')) {
    return c.notFound(); // This will let Cloudflare serve the actual JS/CSS files
  }
  
  // For all other routes, serve the SPA with dynamically embedded HTML
  return c.html(`__INDEX_HTML_PLACEHOLDER__`);
});

// 404 handler for API routes only
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not Found' }, 404);
  }
  // Non-API 404s should have been handled by the SPA route above
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled: sessionCleanup.scheduled,
};
