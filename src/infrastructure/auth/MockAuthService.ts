/**
 * Mock Authentication Service for Local Development
 * Bypasses OIDC and provides test users
 */

import { JWTService } from './JWTService';

export interface MockUser {
  id: string;
  oidcSubjectId: string;
  nickname: string;
  status: 'GENERAL' | 'VERIFIED';
  rank?: 'Gold' | 'Silver' | 'Bronze';
  linkedVcDid?: string;
}

export class MockAuthService {
  private jwtService: JWTService;
  
  // Test users for development
  private mockUsers: MockUser[] = [
    {
      id: 'user-1',
      oidcSubjectId: 'mock-oidc-1',
      nickname: '測試用戶 (一般)',
      status: 'GENERAL'
    },
    {
      id: 'user-2', 
      oidcSubjectId: 'mock-oidc-2',
      nickname: '金牌會員',
      status: 'VERIFIED',
      rank: 'Gold',
      linkedVcDid: 'did:example:gold-member'
    },
    {
      id: 'user-3',
      oidcSubjectId: 'mock-oidc-3', 
      nickname: '銀牌會員',
      status: 'VERIFIED',
      rank: 'Silver',
      linkedVcDid: 'did:example:silver-member'
    },
    {
      id: 'user-4',
      oidcSubjectId: 'mock-oidc-4',
      nickname: '銅牌會員', 
      status: 'VERIFIED',
      rank: 'Bronze',
      linkedVcDid: 'did:example:bronze-member'
    }
  ];

  constructor(jwtSecret: string) {
    this.jwtService = new JWTService(jwtSecret);
  }

  getMockUsers(): MockUser[] {
    return this.mockUsers;
  }

  getMockUser(userId: string): MockUser | undefined {
    return this.mockUsers.find(user => user.id === userId);
  }

  async createMockSession(userId: string): Promise<string> {
    const user = this.getMockUser(userId);
    if (!user) {
      throw new Error('Mock user not found');
    }

    return await this.jwtService.sign({
      sub: user.oidcSubjectId,
      memberId: user.id
    }, 24 * 3600); // 24 hours for dev
  }

  async verifyMockSession(token: string) {
    return await this.jwtService.verify(token);
  }

  // Mock VC verification for testing
  mockVCVerification(userId: string, rank: 'Gold' | 'Silver' | 'Bronze') {
    return {
      transactionId: `mock-tx-${Date.now()}`,
      qrCodeUrl: `data:image/svg+xml;base64,${btoa(`
        <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="200" fill="white"/>
          <text x="100" y="100" text-anchor="middle" font-family="Arial" font-size="14">
            Mock QR Code
          </text>
          <text x="100" y="120" text-anchor="middle" font-family="Arial" font-size="12">
            ${rank} Rank
          </text>
        </svg>
      `)}`,
      authUri: `mock://vc-verification/${userId}/${rank}`,
      status: 'pending' as const,
      pollInterval: 2000 // 2 seconds for faster testing
    };
  }

  // Simulate VC verification completion
  completeMockVCVerification(transactionId: string, rank: 'Gold' | 'Silver' | 'Bronze') {
    return {
      transactionId,
      status: 'completed' as const,
      extractedClaims: {
        did: `did:example:${rank.toLowerCase()}-${Date.now()}`,
        rank
      }
    };
  }
}
