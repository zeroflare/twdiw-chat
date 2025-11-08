/**
 * Chat API Endpoints
 * Handles forum and private chat entry with tlk.io integration
 */

import { Hono } from 'hono';
import { TlkIoAdapter } from '../infrastructure/adapters/TlkIoAdapter';
import { D1MemberProfileRepository } from '../infrastructure/repositories/D1MemberProfileRepository';
import { D1ForumRepository } from '../infrastructure/repositories/D1ForumRepository';
import { D1PrivateChatSessionRepository } from '../infrastructure/repositories/D1PrivateChatSessionRepository';
import { authMiddleware } from '../middleware/auth';

const app = new Hono();

// Rate limiting for chat entry
const chatRateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkChatRateLimit(memberId: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const key = `chat_entry_${memberId}`;
  const current = chatRateLimitMap.get(key);

  if (!current || now > current.resetTime) {
    chatRateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

// GET /api/chat/forum/:forumId - Enter forum chat
app.get('/forum/:forumId', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const forumId = c.req.param('forumId');

    // Rate limiting
    if (!checkChatRateLimit(user.memberId)) {
      return c.json({ error: 'Rate limit exceeded. Please try again later.' }, 429);
    }

    // Get member profile
    const memberRepo = new D1MemberProfileRepository(c.env.DB, c.env.ENCRYPTION_KEY);
    const member = await memberRepo.findById(user.memberId);

    if (!member) {
      return c.json({ error: 'Member not found' }, 404);
    }

    // Get forum
    const forumRepo = new D1ForumRepository(c.env.DB);
    const forum = await forumRepo.findById(forumId);

    if (!forum) {
      return c.json({ error: 'Forum not found' }, 404);
    }

    // Check access permission
    if (!member.canAccessForum(forum.getRequiredRank())) {
      return c.json({ 
        error: 'Access denied. Verification required for this forum.',
        requiredRank: forum.getRequiredRank(),
        memberStatus: member.getStatus()
      }, 403);
    }

    // Check if forum is full
    if (forum.isFull()) {
      return c.json({ error: 'Forum is currently full. Please try again later.' }, 503);
    }

    // Generate chat info
    const tlkAdapter = new TlkIoAdapter(c.env);
    const chatInfo = tlkAdapter.createForumChatInfo({
      forumId,
      memberId: user.memberId,
      nickname: member.getNickname()
    });

    // Increment forum member count (optimistic)
    try {
      forum.incrementMemberCount();
      await forumRepo.save(forum);
    } catch (error) {
      console.warn('Failed to increment forum member count:', error);
      // Continue anyway - not critical for chat access
    }

    return c.json({
      channelId: chatInfo.channelId,
      embedHtml: chatInfo.embedHtml,
      nickname: chatInfo.nickname,
      forumInfo: {
        id: forum.getId(),
        description: forum.getDescription(),
        requiredRank: forum.getRequiredRank(),
        memberCount: forum.getMemberCount(),
        capacity: forum.getCapacity()
      }
    });

  } catch (error) {
    console.error('Forum chat entry failed:', error);
    return c.json({ error: 'Failed to enter forum chat' }, 500);
  }
});

// GET /api/chat/session/:sessionId - Enter private chat
app.get('/session/:sessionId', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const sessionId = c.req.param('sessionId');

    // Rate limiting
    if (!checkChatRateLimit(user.memberId)) {
      return c.json({ error: 'Rate limit exceeded. Please try again later.' }, 429);
    }

    // Get member profile
    const memberRepo = new D1MemberProfileRepository(c.env.DB, c.env.ENCRYPTION_KEY);
    const member = await memberRepo.findById(user.memberId);

    if (!member) {
      return c.json({ error: 'Member not found' }, 404);
    }

    // Get chat session
    const sessionRepo = new D1PrivateChatSessionRepository(c.env.DB);
    const session = await sessionRepo.findById(sessionId);

    if (!session) {
      return c.json({ error: 'Chat session not found' }, 404);
    }

    // Check if member is participant
    if (!session.isMemberParticipant(user.memberId)) {
      return c.json({ error: 'Access denied. You are not a participant in this chat.' }, 403);
    }

    // Check if session is expired
    if (session.isExpired()) {
      session.markAsExpired();
      await sessionRepo.save(session);
      return c.json({ error: 'Chat session has expired' }, 410);
    }

    // Generate chat info
    const tlkAdapter = new TlkIoAdapter(c.env);
    const chatInfo = tlkAdapter.createPrivateChatInfo({
      sessionId,
      memberId: user.memberId,
      nickname: member.getNickname()
    });

    return c.json({
      channelId: chatInfo.channelId,
      embedHtml: chatInfo.embedHtml,
      nickname: chatInfo.nickname,
      sessionInfo: {
        id: session.getId(),
        type: session.getType(),
        expiresAt: session.getExpiresAt(),
        createdAt: session.getCreatedAt(),
        otherMemberId: session.getOtherMemberId(user.memberId)
      }
    });

  } catch (error) {
    console.error('Private chat entry failed:', error);
    return c.json({ error: 'Failed to enter private chat' }, 500);
  }
});

// POST /api/chat/forum/:forumId/leave - Leave forum chat
app.post('/forum/:forumId/leave', authMiddleware(), async (c) => {
  try {
    const forumId = c.req.param('forumId');

    // Get forum and decrement member count
    const forumRepo = new D1ForumRepository(c.env.DB);
    const forum = await forumRepo.findById(forumId);

    if (forum && forum.getMemberCount() > 0) {
      forum.decrementMemberCount();
      await forumRepo.save(forum);
    }

    return c.json({ message: 'Left forum chat successfully' });

  } catch (error) {
    console.error('Forum chat leave failed:', error);
    return c.json({ error: 'Failed to leave forum chat' }, 500);
  }
});

export default app;
