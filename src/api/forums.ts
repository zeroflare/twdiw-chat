/**
 * Forums API Endpoints
 * Handles forum listing and access control
 */

import { Hono } from 'hono';
import { optionalAuthMiddleware } from '../middleware/auth';

const app = new Hono();

// GET /api/forums - List available forums
app.get('/', optionalAuthMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const userRank = user?.rank || null;

    // Mock forum data - replace with actual database query
    const forums = [
      {
        id: 'gold-forum',
        description: 'Gold Members Exclusive Forum',
        requiredRank: 'Gold',
        memberCount: 15,
        capacity: 50,
        accessible: userRank === 'Gold'
      },
      {
        id: 'silver-forum', 
        description: 'Silver Members Forum',
        requiredRank: 'Silver',
        memberCount: 25,
        capacity: 100,
        accessible: userRank === 'Silver' || userRank === 'Gold'
      },
      {
        id: 'bronze-forum',
        description: 'Bronze Members Forum', 
        requiredRank: 'Bronze',
        memberCount: 40,
        capacity: 200,
        accessible: userRank === 'Bronze' || userRank === 'Silver' || userRank === 'Gold'
      }
    ];

    return c.json({ forums });
  } catch (error) {
    console.error('Get forums failed:', error);
    return c.json({ error: 'Failed to get forums' }, 500);
  }
});

export default app;
