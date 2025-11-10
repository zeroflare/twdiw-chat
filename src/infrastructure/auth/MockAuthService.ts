/**
 * Mock Authentication Service for Local Development
 * Bypasses OIDC and provides test users
 */

import { JWTService } from './JWTService';
import { Rank } from '../../domain/entities/MemberProfile';

export interface MockUser {
  id: string;
  oidcSubjectId: string;
  nickname: string;
  status: 'GENERAL' | 'VERIFIED';
  rank?: Rank;
  linkedVcDid?: string;
}

export class MockAuthService {
  private jwtService: JWTService;
  
  // Test users for development
  private mockUsers: MockUser[] = [
    {
      id: 'test-user-need-vc',
      oidcSubjectId: 'mockuser@test.com',
      nickname: 'Mock Test User (需要驗證)',
      status: 'GENERAL'
    },
    {
      id: 'user-1',
      oidcSubjectId: 'mock-oidc-1',
      nickname: '測試用戶 (一般)',
      status: 'GENERAL'
    },
    {
      id: 'user-2', 
      oidcSubjectId: 'mock-oidc-2',
      nickname: '地球OL財富畢業證書持有者',
      status: 'VERIFIED',
      rank: Rank.EARTH_OL_GRADUATE,
      linkedVcDid: 'did:example:earth-ol-graduate'
    },
    {
      id: 'user-3',
      oidcSubjectId: 'mock-oidc-3', 
      nickname: '人生勝利組S級玩家',
      status: 'VERIFIED',
      rank: Rank.LIFE_WINNER_S,
      linkedVcDid: 'did:example:life-winner-s'
    },
    {
      id: 'user-4',
      oidcSubjectId: 'mock-oidc-4',
      nickname: '準富豪VIP會員', 
      status: 'VERIFIED',
      rank: Rank.QUASI_WEALTHY_VIP,
      linkedVcDid: 'did:example:quasi-wealthy-vip'
    },
    {
      id: 'user-5',
      oidcSubjectId: 'mock-oidc-5',
      nickname: '尊爵不凡小資族',
      status: 'VERIFIED', 
      rank: Rank.DISTINGUISHED_PETTY,
      linkedVcDid: 'did:example:distinguished-petty'
    },
    {
      id: 'user-6',
      oidcSubjectId: 'mock-oidc-6',
      nickname: '新手村榮譽村民',
      status: 'VERIFIED',
      rank: Rank.NEWBIE_VILLAGE,
      linkedVcDid: 'did:example:newbie-village'
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
  mockVCVerification(userId: string, rank: Rank) {
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
  completeMockVCVerification(transactionId: string, rank: Rank) {
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
