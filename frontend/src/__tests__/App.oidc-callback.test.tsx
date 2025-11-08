/**
 * Test suite for OIDC callback route handling in App.tsx
 *
 * Scenario: After successful OIDC login, user is redirected back from SSO provider
 * to /api/auth/callback. Backend processes the callback and returns JSON response.
 * Frontend needs to handle this route by:
 * 1. Detecting the callback route
 * 2. Refreshing the auth state to fetch updated user data
 * 3. Redirecting to the main dashboard
 *
 * This test follows TDD methodology (RED phase).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// Mock the auth hook
vi.mock('../hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: vi.fn(() => ({
    user: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  })),
}));

// Mock the components to avoid dependencies
vi.mock('../components/auth/LoginButton', () => ({
  LoginButton: () => <div>LoginButton</div>,
}));

vi.mock('../components/auth/UserProfile', () => ({
  UserProfile: () => <div>UserProfile</div>,
}));

vi.mock('../components/vc/VCVerification', () => ({
  VCVerification: () => <div>VCVerification</div>,
}));

vi.mock('../components/forum/ForumList', () => ({
  ForumList: () => <div>ForumList</div>,
}));

vi.mock('../components/auth/DevLogin', () => ({
  DevLogin: () => <div>DevLogin</div>,
}));

vi.mock('../components/matching/DailyMatching', () => ({
  DailyMatching: () => <div>DailyMatching</div>,
}));

vi.mock('../components/chat/ChatSession', () => ({
  ChatSession: () => <div>ChatSession</div>,
}));

vi.mock('../services/api', () => ({
  api: {
    isDevMode: false,
  },
}));

describe('App.tsx - OIDC Callback Route Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Route: /api/auth/callback', () => {
    it('should have a route for /api/auth/callback', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/api/auth/callback']}>
          <App />
        </MemoryRouter>
      );

      // Route should be registered (not showing 404 or empty)
      expect(container.querySelector('body')).toBeTruthy();
    });

    it('should call refreshUser when landing on /api/auth/callback route', async () => {
      const mockRefreshUser = vi.fn();
      const { useAuth } = await import('../hooks/useAuth');

      vi.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: mockRefreshUser,
      });

      render(
        <MemoryRouter initialEntries={['/api/auth/callback?code=test123&state=test']}>
          <App />
        </MemoryRouter>
      );

      // Should call refreshUser to fetch updated user state after OIDC callback
      await waitFor(() => {
        expect(mockRefreshUser).toHaveBeenCalled();
      });
    });

    it('should redirect to dashboard (/) after successful callback', async () => {
      const mockRefreshUser = vi.fn();
      const { useAuth } = await import('../hooks/useAuth');

      vi.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: mockRefreshUser,
      });

      render(
        <MemoryRouter initialEntries={['/api/auth/callback?code=test123']}>
          <App />
        </MemoryRouter>
      );

      // After refreshing user state, should redirect to main dashboard
      await waitFor(() => {
        // Should show main app content (not callback handler)
        expect(screen.queryByText('歡迎來到三人行必有我師論壇')).toBeTruthy();
      });
    });

    it('should show loading state while processing callback', async () => {
      const mockRefreshUser = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      const { useAuth } = await import('../hooks/useAuth');

      vi.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: mockRefreshUser,
      });

      render(
        <MemoryRouter initialEntries={['/api/auth/callback?code=test123']}>
          <App />
        </MemoryRouter>
      );

      // Should show loading indicator while processing callback
      expect(screen.queryByText(/處理登入/i) || screen.queryByText(/載入/i)).toBeTruthy();
    });

    it('should work with authenticated user after callback', async () => {
      const mockRefreshUser = vi.fn();
      const { useAuth } = await import('../hooks/useAuth');

      // Simulate user being authenticated after refreshUser call
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'user123',
          oidcSubjectId: 'test@example.com',
          nickname: 'Test User',
          status: 'GENERAL',
        },
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: mockRefreshUser,
      });

      render(
        <MemoryRouter initialEntries={['/api/auth/callback?code=test123']}>
          <App />
        </MemoryRouter>
      );

      // After callback processing, should show authenticated user content
      await waitFor(() => {
        expect(screen.queryByText('UserProfile')).toBeTruthy();
      });
    });

    it('should handle callback without code parameter gracefully', async () => {
      const mockRefreshUser = vi.fn();
      const { useAuth } = await import('../hooks/useAuth');

      vi.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: mockRefreshUser,
      });

      render(
        <MemoryRouter initialEntries={['/api/auth/callback']}>
          <App />
        </MemoryRouter>
      );

      // Should still attempt to refresh user state
      await waitFor(() => {
        expect(mockRefreshUser).toHaveBeenCalled();
      });
    });
  });
});
