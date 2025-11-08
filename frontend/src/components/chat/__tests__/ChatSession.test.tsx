import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ChatSession } from '../ChatSession';
import * as apiModule from '../../../services/api';
import React from 'react';

// Mock the API module
vi.mock('../../../services/api', () => ({
  api: {
    request: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('ChatSession Component - Re-rendering and State Management', () => {
  const mockChatData1 = {
    channelId: 'test-channel-1',
    embedHtml: '<iframe id="chat-1" src="https://tlk.io/test-channel-1"></iframe>',
    nickname: 'User1',
    sessionInfo: {
      id: 'session-1',
      type: 'DAILY_MATCH',
      expiresAt: Date.now() + 86400000,
      createdAt: Date.now(),
      otherMemberId: 'member-1',
    },
  };

  const mockChatData2 = {
    channelId: 'test-channel-2',
    embedHtml: '<iframe id="chat-2" src="https://tlk.io/test-channel-2"></iframe>',
    nickname: 'User2',
    sessionInfo: {
      id: 'session-2',
      type: 'DAILY_MATCH',
      expiresAt: Date.now() + 86400000,
      createdAt: Date.now(),
      otherMemberId: 'member-2',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock user
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', nickname: 'TestUser1', status: 'GENERAL' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should clean up DOM when sessionId changes (prevent DOM conflicts)', async () => {
    const apiMock = vi.mocked(apiModule.api.request);

    // First session
    apiMock.mockResolvedValueOnce({ data: mockChatData1 });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('載入聊天室中...')).not.toBeInTheDocument();
    });

    // Verify first chat is loaded
    const container1 = document.querySelector('#chat-1');
    expect(container1).toBeTruthy();

    // Switch to second session
    apiMock.mockResolvedValueOnce({ data: mockChatData2 });

    rerender(
      <MemoryRouter initialEntries={['/chat/session-2']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      const container2 = document.querySelector('#chat-2');
      expect(container2).toBeTruthy();
    });

    // First chat should be cleaned up (no DOM conflict)
    const oldContainer = document.querySelector('#chat-1');
    expect(oldContainer).toBeFalsy();
  });

  it('should reset loading state when sessionId changes', async () => {
    const apiMock = vi.mocked(apiModule.api.request);

    apiMock.mockResolvedValueOnce({ data: mockChatData1 });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('載入聊天室中...')).not.toBeInTheDocument();
    });

    // Switch session - should show loading again
    apiMock.mockResolvedValueOnce({ data: mockChatData2 });

    rerender(
      <MemoryRouter initialEntries={['/chat/session-2']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    // Should briefly show loading state
    expect(screen.getByText('載入聊天室中...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('載入聊天室中...')).not.toBeInTheDocument();
    });
  });

  it('should not persist old nickname when switching members', async () => {
    const apiMock = vi.mocked(apiModule.api.request);

    apiMock.mockResolvedValueOnce({ data: mockChatData1 });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('載入聊天室中...')).not.toBeInTheDocument();
    });

    // Switch to different session with different nickname
    apiMock.mockResolvedValueOnce({ data: mockChatData2 });

    rerender(
      <MemoryRouter initialEntries={['/chat/session-2']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      const container = document.querySelector('#chat-2');
      expect(container).toBeTruthy();
    });

    // Old chat with old nickname should not exist
    const oldContainer = document.querySelector('#chat-1');
    expect(oldContainer).toBeFalsy();
  });

  it('should call API with new sessionId when sessionId changes', async () => {
    const apiMock = vi.mocked(apiModule.api.request);

    apiMock.mockResolvedValueOnce({ data: mockChatData1 });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/chat/session/session-1');
    });

    apiMock.mockClear();
    apiMock.mockResolvedValueOnce({ data: mockChatData2 });

    rerender(
      <MemoryRouter initialEntries={['/chat/session-2']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/chat/session/session-2');
    });
  });

  it('should properly cleanup on unmount', async () => {
    const apiMock = vi.mocked(apiModule.api.request);

    apiMock.mockResolvedValueOnce({ data: mockChatData1 });

    const { unmount } = render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('載入聊天室中...')).not.toBeInTheDocument();
    });

    const containerBefore = document.querySelector('#chat-1');
    expect(containerBefore).toBeTruthy();

    unmount();

    // After unmount, the component's DOM should be cleaned up
    const containerAfter = document.querySelector('#chat-1');
    expect(containerAfter).toBeFalsy();
  });

  it('should reset error state when sessionId changes', async () => {
    const apiMock = vi.mocked(apiModule.api.request);

    // First request fails
    apiMock.mockResolvedValueOnce({ error: 'Session not found' });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Session not found')).toBeInTheDocument();
    });

    // Second request succeeds
    apiMock.mockResolvedValueOnce({ data: mockChatData2 });

    rerender(
      <MemoryRouter initialEntries={['/chat/session-2']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    // Error should be cleared, loading should show
    await waitFor(() => {
      expect(screen.queryByText('Session not found')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByText('載入聊天室中...')).not.toBeInTheDocument();
    });
  });
});

describe('ChatSession Component - Member Switching Detection', () => {
  const mockChatData = {
    channelId: 'test-channel-1',
    embedHtml: '<iframe id="chat-1" src="https://tlk.io/test-channel-1"></iframe>',
    nickname: 'User1',
    sessionInfo: {
      id: 'session-1',
      type: 'DAILY_MATCH',
      expiresAt: Date.now() + 86400000,
      createdAt: Date.now(),
      otherMemberId: 'member-1',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should force component reload when user ID changes (member switching)', async () => {
    const apiMock = vi.mocked(apiModule.api.request);
    apiMock.mockResolvedValue({ data: mockChatData });

    // Initial render with user-1
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', nickname: 'TestUser1', status: 'GENERAL' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('載入聊天室中...')).not.toBeInTheDocument();
    });

    const firstRenderContainer = document.querySelector('#chat-1');
    expect(firstRenderContainer).toBeTruthy();

    // Clear the API mock to track new calls
    apiMock.mockClear();

    // Simulate member switch - dev login as different user
    mockUseAuth.mockReturnValue({
      user: { id: 'user-2', nickname: 'TestUser2', status: 'GENERAL' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    // Re-render with same sessionId but different user
    rerender(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    // Component should reload and call API again
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/chat/session/session-1');
    });

    // Should show loading state during reload
    expect(screen.getByText('載入聊天室中...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('載入聊天室中...')).not.toBeInTheDocument();
    });
  });

  it('should use user ID as React key to prevent nickname cache issues', async () => {
    const apiMock = vi.mocked(apiModule.api.request);

    const chatDataForUser1 = {
      ...mockChatData,
      nickname: 'CachedNickname1',
    };

    const chatDataForUser2 = {
      ...mockChatData,
      nickname: 'CachedNickname2',
    };

    // First user
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', nickname: 'TestUser1', status: 'GENERAL' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    apiMock.mockResolvedValueOnce({ data: chatDataForUser1 });

    const { rerender, container } = render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('載入聊天室中...')).not.toBeInTheDocument();
    });

    // Switch to different user
    mockUseAuth.mockReturnValue({
      user: { id: 'user-2', nickname: 'TestUser2', status: 'GENERAL' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    apiMock.mockResolvedValueOnce({ data: chatDataForUser2 });

    rerender(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for new data to load
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledTimes(2);
    });

    // The component should have been completely remounted due to key change
    // This prevents any cached state from user-1 affecting user-2's session
    expect(container.innerHTML).not.toContain('CachedNickname1');
  });

  it('should clear state when member switches to prevent stale data', async () => {
    const apiMock = vi.mocked(apiModule.api.request);

    // User 1 session
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', nickname: 'TestUser1', status: 'GENERAL' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    apiMock.mockResolvedValueOnce({ data: mockChatData });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('載入聊天室中...')).not.toBeInTheDocument();
    });

    // Switch to user 2
    mockUseAuth.mockReturnValue({
      user: { id: 'user-2', nickname: 'TestUser2', status: 'GENERAL' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    apiMock.mockImplementation(() => new Promise(() => {})); // Never resolve to check loading state

    rerender(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    // Should immediately show loading state (state was cleared)
    await waitFor(() => {
      expect(screen.getByText('載入聊天室中...')).toBeInTheDocument();
    });
  });

  it('should not reload when user ID stays the same', async () => {
    const apiMock = vi.mocked(apiModule.api.request);
    apiMock.mockResolvedValue({ data: mockChatData });

    // Initial render with user-1
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', nickname: 'TestUser1', status: 'GENERAL' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('載入聊天室中...')).not.toBeInTheDocument();
    });

    expect(apiMock).toHaveBeenCalledTimes(1);
    apiMock.mockClear();

    // Re-render with same user (just a regular re-render)
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', nickname: 'TestUser1', status: 'GENERAL' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    rerender(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    // Should not call API again (no reload)
    await waitFor(() => {
      expect(apiMock).not.toHaveBeenCalled();
    }, { timeout: 1000 });
  });
});

describe('ChatSession Component - Backend-Only Embed Approach', () => {
  const mockChatData = {
    channelId: 'test-channel-1',
    embedHtml: '<iframe id="chat-1" src="https://tlk.io/test-channel-1"></iframe>',
    nickname: 'User1',
    sessionInfo: {
      id: 'session-1',
      type: 'DAILY_MATCH',
      expiresAt: Date.now() + 86400000,
      createdAt: Date.now(),
      otherMemberId: 'member-1',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', oidcSubjectId: 'oidc-123', nickname: 'TestUser1', status: 'GENERAL' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    // Clean up any scripts added to the DOM
    const scripts = document.querySelectorAll('script[src*="tlk.io"]');
    scripts.forEach(script => script.remove());
  });

  it('should NOT manually load tlk.io script (backend-only approach)', async () => {
    const apiMock = vi.mocked(apiModule.api.request);
    apiMock.mockResolvedValueOnce({ data: mockChatData });

    render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('載入聊天室中...')).not.toBeInTheDocument();
    });

    // Verify chat is rendered via dangerouslySetInnerHTML
    const chatIframe = document.querySelector('#chat-1');
    expect(chatIframe).toBeTruthy();

    // CRITICAL: Component should NOT manually add tlk.io script to DOM
    const tlkScripts = document.querySelectorAll('script[src*="tlk.io/embed.js"]');
    expect(tlkScripts.length).toBe(0);
  });

  it('should NOT dispatch window load events (backend handles iframe loading)', async () => {
    const apiMock = vi.mocked(apiModule.api.request);
    apiMock.mockResolvedValueOnce({ data: mockChatData });

    const loadEventSpy = vi.fn();
    window.addEventListener('load', loadEventSpy);

    render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('載入聊天室中...')).not.toBeInTheDocument();
    });

    // Wait a bit to ensure no delayed script loading
    await new Promise(resolve => setTimeout(resolve, 500));

    // Component should NOT dispatch artificial load events
    expect(loadEventSpy).not.toHaveBeenCalled();

    window.removeEventListener('load', loadEventSpy);
  });

  it('should only rely on backend embedHtml for chat rendering', async () => {
    const apiMock = vi.mocked(apiModule.api.request);
    apiMock.mockResolvedValueOnce({ data: mockChatData });

    const { container } = render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<ChatSession />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('載入聊天室中...')).not.toBeInTheDocument();
    });

    // Verify embedHtml is rendered via dangerouslySetInnerHTML
    const embedContainer = container.querySelector('div[class*="w-full"]');
    expect(embedContainer).toBeTruthy();
    expect(embedContainer?.innerHTML).toContain('iframe');
    expect(embedContainer?.innerHTML).toContain('tlk.io/test-channel-1');

    // No frontend script manipulation
    expect(document.querySelectorAll('script[src*="tlk.io"]').length).toBe(0);
  });
});
