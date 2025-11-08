// API service for backend communication
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface Member {
  id: string;
  oidcSubjectId: string;
  nickname: string;
  status: 'GENERAL' | 'VERIFIED';
  rank?: 'Gold' | 'Silver' | 'Bronze';
  linkedVcDid?: string;
}

export interface Forum {
  id: string;
  description: string;
  requiredRank: 'EARTH_OL_GRADUATE' | 'LIFE_WINNER_S' | 'QUASI_WEALTHY_VIP' | 'DISTINGUISHED_PETTY' | 'NEWBIE_VILLAGE';
  memberCount: number;
  capacity: number;
  accessible: boolean;
}

export interface VerificationResult {
  transactionId: string;
  qrCodeUrl?: string;
  authUri?: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  pollInterval?: number;
  extractedClaims?: {
    did: string;
    rank: string;
  };
  error?: string;
}

export interface MockUser {
  id: string;
  nickname: string;
  status: 'GENERAL' | 'VERIFIED';
  rank?: 'Gold' | 'Silver' | 'Bronze';
}

class ApiService {
  private baseUrl = import.meta.env.VITE_API_URL || 'https://twdiw-chat.csw30454.workers.dev/api';
  private isDev = import.meta.env.DEV || window.location.hostname === 'localhost';

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || `HTTP ${response.status}` };
      }

      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  // Development mode helpers
  get isDevMode() {
    return this.isDev;
  }

  // Development: Get mock users
  async getMockUsers() {
    if (!this.isDev) return { error: 'Not in development mode' };
    return this.request<{ users: MockUser[] }>('/dev/users');
  }

  // Development: Mock login
  async mockLogin(userId: string) {
    if (!this.isDev) return { error: 'Not in development mode' };
    return this.request<{ user: Member; sessionToken: string }>(`/dev/login/${userId}`, {
      method: 'POST',
    });
  }

  // Development: Seed test data
  async seedTestData() {
    if (!this.isDev) return { error: 'Not in development mode' };
    return this.request('/dev/seed-data', { method: 'POST' });
  }

  // Authentication
  // Both OIDC login and mockLogin are available in development mode
  // Use login() for real OIDC authentication testing
  // Use mockLogin(userId) for quick mock authentication
  async login() {
    return this.request<{ authUrl: string }>('/auth/login');
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  async getCurrentUser() {
    return this.request<Member>('/auth/me');
  }

  async refreshToken() {
    return this.request('/auth/refresh', { method: 'POST' });
  }

  // VC Verification
  async startVCVerification() {
    return this.request<VerificationResult>('/vc/verify/start', {
      method: 'POST',
    });
  }

  async pollVCVerification(transactionId: string) {
    return this.request<VerificationResult>(`/vc/verify/poll/${transactionId}`);
  }

  // Development: Mock VC verification
  async mockVCVerification(rank: 'Gold' | 'Silver' | 'Bronze' = 'Gold') {
    if (!this.isDev) return { error: 'Not in development mode' };
    return this.request<VerificationResult>('/dev/vc/mock-verify', {
      method: 'POST',
      body: JSON.stringify({ rank }),
    });
  }

  async completeMockVCVerification(transactionId: string, rank: 'Gold' | 'Silver' | 'Bronze' = 'Gold') {
    if (!this.isDev) return { error: 'Not in development mode' };
    return this.request<VerificationResult>(`/dev/vc/mock-complete/${transactionId}?rank=${rank}`);
  }

  // Forums
  async getForums() {
    return this.request<Forum[]>('/forums');
  }

  async joinForum(forumId: string) {
    return this.request<{
      channelId: string;
      embedHtml: string;
      nickname: string;
      forumInfo: Forum;
    }>(`/chat/forum/${forumId}`);
  }

  async leaveForum(forumId: string) {
    return this.request(`/chat/forum/${forumId}/leave`, { method: 'POST' });
  }

  // Private Chat
  async requestDailyMatch() {
    return this.request<{
      sessionId: string;
      message: string;
    }>('/chat/match', { method: 'POST' });
  }

  async joinPrivateChat(sessionId: string) {
    return this.request<{
      channelId: string;
      embedHtml: string;
      nickname: string;
      sessionInfo: any;
    }>(`/chat/session/${sessionId}`);
  }

  // Admin (if needed)
  async getSessionStats(adminToken: string) {
    return this.request('/admin/sessions/stats', {
      headers: { 'X-Admin-Token': adminToken },
    });
  }

  async cleanupSessions(adminToken: string) {
    return this.request('/admin/cleanup/sessions', {
      method: 'POST',
      headers: { 'X-Admin-Token': adminToken },
    });
  }
}

export const api = new ApiService();
