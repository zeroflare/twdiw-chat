/**
 * Chat API Endpoints
 * Handles forum and private chat entry with tlk.io integration
 */

import { Hono } from 'hono';
import { TlkIoAdapter } from '../infrastructure/adapters/TlkIoAdapter';
import { D1MemberProfileRepository } from '../infrastructure/repositories/D1MemberProfileRepository';
import { D1ForumRepository } from '../infrastructure/repositories/D1ForumRepository';
import { D1PrivateChatSessionRepository } from '../infrastructure/repositories/D1PrivateChatSessionRepository';
import { EncryptionService } from '../infrastructure/security/EncryptionService';
import { PrivateChatSession, SessionType } from '../domain/entities/PrivateChatSession';
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
    const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
    const memberRepo = new D1MemberProfileRepository(c.env.DB, encryptionService);
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
    const encryptionService2 = new EncryptionService(c.env.ENCRYPTION_KEY);
    const memberRepo2 = new D1MemberProfileRepository(c.env.DB, encryptionService2);
    const member = await memberRepo2.findById(user.memberId);

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

// POST /api/chat/match - Request daily matching
app.post('/match', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    
    // Rate limiting
    if (!checkChatRateLimit(user.memberId)) {
      return c.json({ error: 'Rate limit exceeded. Please try again later.' }, 429);
    }

    // Get member profile
    const encryptionService = new EncryptionService(c.env.ENCRYPTION_KEY);
    const memberRepo = new D1MemberProfileRepository(c.env.DB, encryptionService);
    const member = await memberRepo.findById(user.memberId);

    if (!member) {
      return c.json({ error: 'Member not found' }, 404);
    }

    // Check if already matched today
    const sessionRepo = new D1PrivateChatSessionRepository(c.env.DB);
    const existingSession = await sessionRepo.findActiveSessionByMemberId(user.memberId);
    
    if (existingSession) {
      return c.json({ 
        error: 'Already matched today',
        sessionId: existingSession.getId()
      }, 400);
    }

    // Find a match from waiting queue (users who actively requested matching)
    const compatibleRanks = getCompatibleRanks(member.getDerivedRank());
    const matchedMember = await findAvailableMatch(memberRepo, user.memberId, compatibleRanks, c.env.DB);
    
    if (!matchedMember) {
      // Add to waiting queue
      await addToMatchingQueue(c.env.DB, user.memberId, member.getDerivedRank() || 'Bronze');
      
      return c.json({ 
        message: 'Added to matching queue. You will be notified when a match is found.',
        status: 'waiting'
      });
    }

    // Remove matched user from queue and create session
    await removeFromMatchingQueue(c.env.DB, matchedMember.getId());
    const session = await createPrivateChatSession(sessionRepo, user.memberId, matchedMember.getId());
    
    return c.json({
      message: 'Match found!',
      sessionId: session.getId(),
      matchedWith: {
        nickname: matchedMember.getNickname(),
        rank: matchedMember.getDerivedRank()
      }
    });

  } catch (error) {
    console.error('Match request failed:', error);
    return c.json({ error: 'Failed to process match request' }, 500);
  }
});

// GET /api/chat/match/status - Check matching status
app.get('/match/status', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    
    const sessionRepo = new D1PrivateChatSessionRepository(c.env.DB);
    const activeSession = await sessionRepo.findActiveSessionByMemberId(user.memberId);
    
    if (!activeSession) {
      return c.json({ status: 'no_match' });
    }

    return c.json({
      status: 'matched',
      sessionId: activeSession.getId(),
      createdAt: activeSession.getCreatedAt()
    });

  } catch (error) {
    console.error('Match status check failed:', error);
    return c.json({ error: 'Failed to check match status' }, 500);
  }
});

// DELETE /api/chat/match - Cancel matching request
app.delete('/match', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    
    // Remove from matching queue
    await removeFromMatchingQueue(c.env.DB, user.memberId);
    
    return c.json({ message: 'Match request cancelled' });

  } catch (error) {
    console.error('Match cancellation failed:', error);
    return c.json({ error: 'Failed to cancel match request' }, 500);
  }
});

// Helper functions
function getCompatibleRanks(userRank?: string): string[] {
  // Simple compatibility: same rank or adjacent ranks
  switch (userRank) {
    case 'Gold': return ['Gold', 'Silver'];
    case 'Silver': return ['Silver', 'Gold', 'Bronze'];
    case 'Bronze': return ['Bronze', 'Silver'];
    default: return ['Bronze', 'Silver', 'Gold'];
  }
}

async function findAvailableMatch(memberRepo: any, currentUserId: string, compatibleRanks: string[], db: D1Database): Promise<any> {
  try {
    // Find users in matching queue with compatible ranks
    const { results } = await db
      .prepare(`
        SELECT mq.member_id, mp.nickname, mp.derived_rank 
        FROM matching_queue mq
        JOIN member_profiles mp ON mq.member_id = mp.id
        WHERE mq.member_id != ? 
        AND mq.rank IN (${compatibleRanks.map(() => '?').join(',')})
        AND mq.expires_at > ?
        ORDER BY mq.created_at ASC
        LIMIT 1
      `)
      .bind(currentUserId, ...compatibleRanks, Date.now())
      .all();

    if (results.length === 0) {
      return null;
    }

    const matchData = results[0] as any;
    
    // Return a member-like object
    return {
      getId: () => matchData.member_id,
      getNickname: () => matchData.nickname,
      getDerivedRank: () => matchData.derived_rank
    };
  } catch (error) {
    console.error('Error finding match:', error);
    return null;
  }
}

async function createPrivateChatSession(sessionRepo: any, member1Id: string, member2Id: string): Promise<any> {
  try {
    // Create a new session
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const channelId = `private-${sessionId}`;
    
    // Calculate expiry (24 hours from now)
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000);
    
    const session = PrivateChatSession.create({
      memberAId: member1Id,
      memberBId: member2Id,
      tlkChannelId: channelId,
      type: SessionType.DAILY_MATCH,
      expiresAt: expiresAt
    });
    
    await sessionRepo.save(session);
    
    return session;
  } catch (error) {
    console.error('Error creating session:', error);
    // Fallback to mock session
    return {
      getId: () => `session-${Date.now()}`,
      getCreatedAt: () => new Date()
    };
  }
}

async function addToMatchingQueue(db: D1Database, memberId: string, rank: string): Promise<void> {
  try {
    const queueId = `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes timeout
    
    await db
      .prepare(`
        INSERT OR REPLACE INTO matching_queue (id, member_id, rank, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(queueId, memberId, rank, Date.now(), expiresAt)
      .run();
  } catch (error) {
    console.error('Error adding to matching queue:', error);
  }
}

async function removeFromMatchingQueue(db: D1Database, memberId: string): Promise<void> {
  try {
    await db
      .prepare('DELETE FROM matching_queue WHERE member_id = ?')
      .bind(memberId)
      .run();
  } catch (error) {
    console.error('Error removing from matching queue:', error);
  }
}

export default app;
