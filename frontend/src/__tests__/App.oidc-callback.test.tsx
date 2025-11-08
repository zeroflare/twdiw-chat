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

  describe('Infinite Loop Prevention', () => {
    it('should only call refreshUser once, not repeatedly (prevent infinite loop)', async () => {
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

      // Wait for initial effect to run
      await waitFor(() => {
        expect(mockRefreshUser).toHaveBeenCalled();
      });

      // Get initial call count
      const initialCallCount = mockRefreshUser.mock.calls.length;

      // Wait additional time to ensure no repeated calls
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not have additional calls (infinite loop prevention)
      expect(mockRefreshUser).toHaveBeenCalledTimes(initialCallCount);
      expect(initialCallCount).toBe(1); // Should only be called once
    });

    it('should handle error in refreshUser without causing infinite retry loop', async () => {
      const mockRefreshUser = vi.fn().mockRejectedValue(new Error('Auth failed'));
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

      // Wait for effect to run
      await waitFor(() => {
        expect(mockRefreshUser).toHaveBeenCalled();
      });

      const initialCallCount = mockRefreshUser.mock.calls.length;

      // Wait to ensure no retry loop
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not retry on error
      expect(mockRefreshUser).toHaveBeenCalledTimes(initialCallCount);
      expect(initialCallCount).toBe(1);
    });
  });

  describe('URL Parameter Handling', () => {
    it('should handle success parameter in URL', async () => {
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
        <MemoryRouter initialEntries={['/api/auth/callback?success=true']}>
          <App />
        </MemoryRouter>
      );

      // Should still call refreshUser even with success parameter
      await waitFor(() => {
        expect(mockRefreshUser).toHaveBeenCalled();
      });
    });

    it('should handle error parameter in URL', async () => {
      const mockRefreshUser = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { useAuth } = await import('../hooks/useAuth');

      vi.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: mockRefreshUser,
      });

      render(
        <MemoryRouter initialEntries={['/api/auth/callback?error=auth_failed']}>
          <App />
        </MemoryRouter>
      );

      // Should handle error parameter gracefully
      // May log error but should not crash
      await waitFor(() => {
        // Component should still render (not crash)
        expect(screen.queryByText(/處理登入/i) || screen.queryByText(/載入/i)).toBeTruthy();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should redirect after handling URL parameters without infinite redirects', async () => {
      const mockRefreshUser = vi.fn();
      const { useAuth } = await import('../hooks/useAuth');

      vi.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: mockRefreshUser,
      });

      const { container } = render(
        <MemoryRouter initialEntries={['/api/auth/callback?code=test123']}>
          <App />
        </MemoryRouter>
      );

      // Should redirect to main page
      await waitFor(() => {
        expect(screen.queryByText('歡迎來到三人行必有我師論壇')).toBeTruthy();
      });

      // Verify we're not stuck on callback route
      expect(container.textContent).not.toContain('處理登入回應中');
    });
  });
});
