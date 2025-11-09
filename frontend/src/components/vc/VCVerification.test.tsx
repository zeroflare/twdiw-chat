import { describe, expect, it } from 'vitest';
import { mergeVerificationState } from './VCVerification';
import { VerificationResult } from '../../services/api';

describe('mergeVerificationState', () => {
  const baseResult: VerificationResult = {
    transactionId: 'tx-123',
    status: 'pending',
    qrCodeUrl: 'data:image/png;base64,AAA',
    authUri: 'tw-wallet://mock',
  };

  it('returns next result when previous state is null', () => {
    const merged = mergeVerificationState(null, baseResult);
    expect(merged).toEqual(baseResult);
  });

  it('preserves qrCodeUrl and authUri when next result omits them', () => {
    const previous: VerificationResult = {
      transactionId: 'tx-123',
      status: 'pending',
      qrCodeUrl: 'data:image/png;base64,OLD',
      authUri: 'tw-wallet://old',
    };

    const next: VerificationResult = {
      transactionId: 'tx-123',
      status: 'completed',
    };

    const merged = mergeVerificationState(previous, next);

    expect(merged.status).toBe('completed');
    expect(merged.qrCodeUrl).toBe(previous.qrCodeUrl);
    expect(merged.authUri).toBe(previous.authUri);
  });

  it('uses new qrCodeUrl/authUri when provided by next result', () => {
    const previous: VerificationResult = {
      transactionId: 'tx-123',
      status: 'pending',
      qrCodeUrl: 'data:image/png;base64,OLD',
      authUri: 'tw-wallet://old',
    };

    const next: VerificationResult = {
      transactionId: 'tx-123',
      status: 'pending',
      qrCodeUrl: 'data:image/png;base64,NEW',
      authUri: 'tw-wallet://new',
    };

    const merged = mergeVerificationState(previous, next);

    expect(merged.qrCodeUrl).toBe(next.qrCodeUrl);
    expect(merged.authUri).toBe(next.authUri);
  });
});
