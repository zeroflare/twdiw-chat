/**
 * VC Verification API Endpoints
 * Handles VC verification initiation and status polling
 */

import { Hono } from 'hono';
import { VCVerificationService } from '../infrastructure/services/VCVerificationService';
import { VCVerificationSessionStore } from '../infrastructure/services/VCVerificationSessionStore';
import { D1MemberProfileRepository } from '../infrastructure/repositories/D1MemberProfileRepository';
import { authMiddleware } from '../middleware/auth';

const app = new Hono();

// Rate limiting map (in production, use KV or external service)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(memberId: string, maxRequests = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const key = `vc_verify_${memberId}`;
  const current = rateLimitMap.get(key);

  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

// POST /api/vc/verify/start - Initiate VC verification
app.post('/start', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const memberId = user.memberId;

    // Rate limiting
    if (!checkRateLimit(memberId)) {
      return c.json({ error: 'Rate limit exceeded. Please try again later.' }, 429);
    }

    // Check if member already has pending verification
    const sessionStore = new VCVerificationSessionStore(c.env.DB);
    const existingSession = await sessionStore.getSessionByMember(memberId);
    
    if (existingSession && existingSession.status === 'pending') {
      return c.json({
        transactionId: existingSession.transactionId,
        qrCodeUrl: existingSession.qrCodeUrl,
        authUri: existingSession.authUri,
        status: 'pending',
        message: 'Verification already in progress'
      });
    }

    // Initiate new verification
    const vcService = new VCVerificationService(c.env);
    const result = await vcService.initiateVerification({ memberId });

    // Store session
    await sessionStore.createSession({
      transactionId: result.transactionId,
      memberId,
      status: 'pending',
      qrCodeUrl: result.qrCodeUrl,
      authUri: result.authUri,
      expiresAt: result.expiresAt?.getTime() || Date.now() + 10 * 60 * 1000
    });

    return c.json({
      transactionId: result.transactionId,
      qrCodeUrl: result.qrCodeUrl,
      authUri: result.authUri,
      status: result.status,
      pollInterval: result.pollInterval || 5000,
      expiresAt: result.expiresAt
    });

  } catch (error) {
    console.error('VC verification start failed:', error);
    return c.json({ error: 'Failed to start verification' }, 500);
  }
});

// GET /api/vc/verify/poll/:transactionId - Poll verification status
app.get('/poll/:transactionId', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const transactionId = c.req.param('transactionId');

    // Get session from store
    const sessionStore = new VCVerificationSessionStore(c.env.DB);
    const session = await sessionStore.getSession(transactionId);

    if (!session) {
      return c.json({ error: 'Verification session not found' }, 404);
    }

    // Verify ownership
    if (session.memberId !== user.memberId) {
      return c.json({ error: 'Unauthorized access to verification session' }, 403);
    }

    // Check if already completed
    if (session.status !== 'pending') {
      return c.json({
        transactionId,
        status: session.status,
        error: session.error,
        extractedClaims: session.extractedDid && session.extractedRank ? {
          did: session.extractedDid,
          rank: session.extractedRank
        } : undefined
      });
    }

    // Poll twdiw API
    const vcService = new VCVerificationService(c.env);
    const result = await vcService.checkVerificationStatus(transactionId);

    // Update session based on result
    if (result.status === 'completed' && result.extractedClaims) {
      // Update member profile
      const memberRepo = new D1MemberProfileRepository(c.env.DB, c.env.ENCRYPTION_KEY);
      const member = await memberRepo.findById(user.memberId);
      
      if (member) {
        member.verifyWithRankCard(
          result.extractedClaims.did, 
          result.extractedClaims.rank as any
        );
        await memberRepo.save(member);
      }

      // Update session
      await sessionStore.updateSession(transactionId, {
        status: 'completed',
        verifiableCredential: result.verifiableCredential,
        extractedDid: result.extractedClaims.did,
        extractedRank: result.extractedClaims.rank,
        completedAt: Date.now()
      });

      return c.json({
        transactionId,
        status: 'completed',
        extractedClaims: result.extractedClaims,
        message: 'Verification completed successfully'
      });

    } else if (result.status === 'failed' || result.status === 'expired') {
      await sessionStore.updateSession(transactionId, {
        status: result.status,
        error: result.error,
        completedAt: Date.now()
      });

      return c.json({
        transactionId,
        status: result.status,
        error: result.error
      });
    }

    // Still pending
    return c.json({
      transactionId,
      status: 'pending',
      pollInterval: result.pollInterval || 5000
    });

  } catch (error) {
    console.error('VC verification poll failed:', error);
    return c.json({ error: 'Failed to check verification status' }, 500);
  }
});

export default app;
