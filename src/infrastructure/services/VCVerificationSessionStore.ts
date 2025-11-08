/**
 * VC Verification Session Store
 * Manages verification sessions with D1 database
 */

export interface VCVerificationSession {
  transactionId: string;
  memberId: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  qrCodeUrl?: string;
  authUri?: string;
  verifiableCredential?: any;
  extractedDid?: string;
  extractedRank?: string;
  error?: string;
  createdAt: number;
  expiresAt: number;
  completedAt?: number;
}

export class VCVerificationSessionStore {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async createSession(session: Omit<VCVerificationSession, 'createdAt'>): Promise<void> {
    const now = Date.now();
    
    await this.db.prepare(`
      INSERT INTO vc_verification_sessions (
        transaction_id, member_id, status, qr_code_url, auth_uri,
        created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      session.transactionId,
      session.memberId,
      session.status,
      session.qrCodeUrl || null,
      session.authUri || null,
      now,
      session.expiresAt
    ).run();
  }

  async updateSession(
    transactionId: string, 
    updates: Partial<Pick<VCVerificationSession, 'status' | 'verifiableCredential' | 'extractedDid' | 'extractedRank' | 'error' | 'completedAt'>>
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    if (updates.verifiableCredential !== undefined) {
      fields.push('verifiable_credential = ?');
      values.push(JSON.stringify(updates.verifiableCredential));
    }

    if (updates.extractedDid !== undefined) {
      fields.push('extracted_did = ?');
      values.push(updates.extractedDid);
    }

    if (updates.extractedRank !== undefined) {
      fields.push('extracted_rank = ?');
      values.push(updates.extractedRank);
    }

    if (updates.error !== undefined) {
      fields.push('error = ?');
      values.push(updates.error);
    }

    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(updates.completedAt);
    }

    if (fields.length === 0) {
      return; // No updates
    }

    fields.push('updated_at = ?');
    values.push(Date.now());

    values.push(transactionId);

    await this.db.prepare(`
      UPDATE vc_verification_sessions 
      SET ${fields.join(', ')}
      WHERE transaction_id = ?
    `).bind(...values).run();
  }

  async getSession(transactionId: string): Promise<VCVerificationSession | null> {
    const result = await this.db.prepare(`
      SELECT * FROM vc_verification_sessions 
      WHERE transaction_id = ?
    `).bind(transactionId).first();

    if (!result) {
      return null;
    }

    return {
      transactionId: result.transaction_id as string,
      memberId: result.member_id as string,
      status: result.status as any,
      qrCodeUrl: result.qr_code_url as string || undefined,
      authUri: result.auth_uri as string || undefined,
      verifiableCredential: result.verifiable_credential 
        ? JSON.parse(result.verifiable_credential as string) 
        : undefined,
      extractedDid: result.extracted_did as string || undefined,
      extractedRank: result.extracted_rank as string || undefined,
      error: result.error as string || undefined,
      createdAt: result.created_at as number,
      expiresAt: result.expires_at as number,
      completedAt: result.completed_at as number || undefined
    };
  }

  async getSessionByMember(memberId: string): Promise<VCVerificationSession | null> {
    const result = await this.db.prepare(`
      SELECT * FROM vc_verification_sessions 
      WHERE member_id = ? AND status = 'pending'
      ORDER BY created_at DESC 
      LIMIT 1
    `).bind(memberId).first();

    if (!result) {
      return null;
    }

    return {
      transactionId: result.transaction_id as string,
      memberId: result.member_id as string,
      status: result.status as any,
      qrCodeUrl: result.qr_code_url as string || undefined,
      authUri: result.auth_uri as string || undefined,
      verifiableCredential: result.verifiable_credential 
        ? JSON.parse(result.verifiable_credential as string) 
        : undefined,
      extractedDid: result.extracted_did as string || undefined,
      extractedRank: result.extracted_rank as string || undefined,
      error: result.error as string || undefined,
      createdAt: result.created_at as number,
      expiresAt: result.expires_at as number,
      completedAt: result.completed_at as number || undefined
    };
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now();
    
    const result = await this.db.prepare(`
      DELETE FROM vc_verification_sessions 
      WHERE expires_at < ? AND status IN ('pending', 'expired')
    `).bind(now).run();

    return result.meta?.changes || 0;
  }
}
