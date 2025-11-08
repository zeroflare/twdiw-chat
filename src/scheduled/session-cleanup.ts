/**
 * Scheduled Session Cleanup Worker
 * Cloudflare Cron job for automatic session expiry and cleanup
 */

import { SessionExpiryService } from '../infrastructure/services/SessionExpiryService';

export interface Env {
  DB: D1Database;
  ENCRYPTION_KEY: string;
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log('Starting scheduled session cleanup...');
    
    try {
      const sessionExpiryService = new SessionExpiryService(env.DB, env.ENCRYPTION_KEY);
      
      // Perform cleanup
      const result = await sessionExpiryService.cleanupExpiredSessions();
      
      // Log results
      console.log('Session cleanup completed:', {
        chatSessionsProcessed: result.chatSessionsProcessed,
        chatSessionsCleaned: result.chatSessionsCleaned,
        vcSessionsProcessed: result.vcSessionsProcessed,
        vcSessionsCleaned: result.vcSessionsCleaned,
        errorCount: result.errors.length
      });

      // Log errors if any
      if (result.errors.length > 0) {
        console.error('Session cleanup errors:', result.errors);
      }

      // Get session statistics for monitoring
      const stats = await sessionExpiryService.getSessionStats();
      console.log('Current session stats:', stats);

    } catch (error) {
      console.error('Scheduled session cleanup failed:', error);
      
      // Don't throw - we don't want to fail the cron job
      // In production, you might want to send alerts here
    }
  }
};
