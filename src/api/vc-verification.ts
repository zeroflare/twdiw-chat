/**
 * VC Verification API Endpoints
 * Handles VC verification initiation and status polling
 */

import { Hono } from 'hono';
import { Rank } from '../domain/entities/MemberProfile';
import { VCVerificationService } from '../infrastructure/services/VCVerificationService';
import { VCVerificationSessionStore } from '../infrastructure/services/VCVerificationSessionStore';
import { D1MemberProfileRepository } from '../infrastructure/repositories/D1MemberProfileRepository';
import { authMiddleware } from '../middleware/auth';

const app = new Hono();
const SESSION_TTL_MS = 5 * 60 * 1000;

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
    const forceRestart = c.req.query('force') === 'true';

    // Rate limiting
    if (!checkRateLimit(memberId)) {
      return c.json({ error: 'Rate limit exceeded. Please try again later.' }, 429);
    }

    // Check if member already has pending verification
    const sessionStore = new VCVerificationSessionStore(c.env.DB);
    const existingSession = await sessionStore.getSessionByMember(memberId);
    const now = Date.now();

    if (existingSession && existingSession.status === 'pending') {
      const isExpired = existingSession.expiresAt <= now;

      if (!isExpired && !forceRestart) {
        return c.json({
          transactionId: existingSession.transactionId,
          qrCodeUrl: existingSession.qrCodeUrl,
          authUri: existingSession.authUri,
          status: 'pending',
          message: 'Verification already in progress'
        });
      }

      await sessionStore.updateSession(existingSession.transactionId, {
        status: 'expired',
        error: forceRestart ? 'Verification session restarted by user' : 'Verification session expired before completion',
        completedAt: now
      });
    }

    // Development mode: return mock verification
    const isDev = c.env.DEV_MODE === 'true' || c.env.NODE_ENV === 'development';
    if (isDev) {
      const mockTransactionId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const mockResult = {
        transactionId: mockTransactionId,
        qrCodeUrl: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk1vY2sgUVIgQ29kZTwvdGV4dD48L3N2Zz4=`,
        authUri: `https://mock-wallet.example.com/verify?tx=${mockTransactionId}`,
        status: 'pending' as const,
        pollInterval: 2000,
        expiresAt: now + SESSION_TTL_MS
      };

      // Store mock session
      await sessionStore.createSession({
        transactionId: mockResult.transactionId,
        memberId,
        status: 'pending',
        qrCodeUrl: mockResult.qrCodeUrl,
        authUri: mockResult.authUri,
        expiresAt: now + SESSION_TTL_MS
      });

      return c.json(mockResult);
    }

    // Production mode: use real VC verification service
    const vcService = new VCVerificationService(c.env);
    const result = await vcService.initiateVerification({ memberId });

    // Store session
    await sessionStore.createSession({
      transactionId: result.transactionId,
      memberId,
      status: 'pending',
      qrCodeUrl: result.qrCodeUrl, // Store the base64 image
      authUri: result.authUri,
      expiresAt: now + SESSION_TTL_MS
    });

    return c.json({
      transactionId: result.transactionId,
      qrCodeUrl: result.qrCodeUrl, // Now contains the base64 image
      authUri: result.authUri,
      status: result.status
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
      return c.json({ 
        error: 'Verification session not found', 
        shouldRestart: true,
        message: 'Session expired. Please restart verification.'
      }, 404);
    }

    // Verify ownership
    if (session.memberId !== user.memberId) {
      return c.json({ error: 'Unauthorized access to verification session' }, 403);
    }

    if (session.status !== 'pending') {
      console.log('[VC verification] returning cached session result', {
        transactionId,
        status: session.status,
        hasExtractedClaims: Boolean(session.extractedDid && session.extractedRank)
      });

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

    // Development mode: simulate verification completion for mock sessions
    const isDev = c.env.DEV_MODE === 'true' || c.env.NODE_ENV === 'development';
    if (isDev && transactionId.startsWith('mock-')) {
      // Simulate random completion after some time
      const sessionAge = Date.now() - parseInt(transactionId.split('-')[1]);
      const shouldComplete = sessionAge > 10000; // Complete after 10 seconds
      
      if (shouldComplete) {
        const mockRanks = [Rank.EARTH_OL_GRADUATE, Rank.LIFE_WINNER_S, Rank.QUASI_WEALTHY_VIP, Rank.DISTINGUISHED_PETTY, Rank.NEWBIE_VILLAGE];
        const randomRank = mockRanks[Math.floor(Math.random() * mockRanks.length)];
        const mockDid = `did:example:mock-${Math.random().toString(36).substr(2, 9)}`;
        
        const result = {
          transactionId,
          status: 'completed' as const,
          verifiableCredential: { mock: true },
          extractedClaims: {
            did: mockDid,
            rank: randomRank
          }
        };

        // Update member profile
        const memberRepo = new D1MemberProfileRepository(c.env.DB, c.env.ENCRYPTION_KEY);
        const member = await memberRepo.findById(user.memberId);
        
        if (member) {
          member.verifyWithRankCard(mockDid, randomRank as any);
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
          message: 'Mock verification completed successfully'
        });
      } else {
        // Still pending
        return c.json({
          transactionId,
          status: 'pending',
          pollInterval: 2000
        });
      }
    }

    // Production mode: Poll twdiw API
    console.log('[VC verification] polling transaction', { transactionId, memberId: user.memberId });

    const vcService = new VCVerificationService(c.env);
    const result = await vcService.checkVerificationStatus(transactionId);

    // Update session based on result
    if (result.status === 'completed' && result.extractedClaims) {
      // Update member profile
      const memberRepo = new D1MemberProfileRepository(c.env.DB, c.env.ENCRYPTION_KEY);
      const member = await memberRepo.findById(user.memberId);
      
      if (member) {
        console.log('[VC verification] applying rank to member', {
          memberId: member.getId(),
          rank: result.extractedClaims.rank,
          did: result.extractedClaims.did
        });

        try {
          console.log('[VC verification] member before verification', {
            memberId: member.getId(),
            currentStatus: member.getStatus(),
            currentRank: member.getDerivedRank(),
            currentLinkedDid: member.getLinkedVcDid()
          });

          member.verifyWithRankCard(
            result.extractedClaims.did, 
            result.extractedClaims.rank as any
          );
          
          console.log('[VC verification] member after verifyWithRankCard', {
            memberId: member.getId(),
            newStatus: member.getStatus(),
            newRank: member.getDerivedRank(),
            newLinkedDid: member.getLinkedVcDid()
          });

          await memberRepo.save(member);
          console.log('[VC verification] member updated successfully', {
            memberId: member.getId(),
            finalStatus: member.getStatus(),
            finalRank: member.getDerivedRank()
          });
        } catch (err) {
          console.error('[VC verification] failed to update member', {
            error: err instanceof Error ? err.message : String(err),
            memberId: member.getId(),
            currentStatus: member.getStatus(),
            extractedRank: result.extractedClaims.rank,
            extractedDid: result.extractedClaims.did
          });
        }
      } else {
        console.warn('[VC verification] member not found for rank update', { memberId: user.memberId });
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

    } else if (result.status === 'completed' && !result.extractedClaims) {
      console.error('[VC verification] completed without extracted claims', {
        transactionId,
        memberId: user.memberId
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
