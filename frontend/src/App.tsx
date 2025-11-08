import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoginButton } from './components/auth/LoginButton';
import { UserProfile } from './components/auth/UserProfile';
import { VCVerification } from './components/vc/VCVerification';
import { ForumList } from './components/forum/ForumList';
import { DevLogin } from './components/auth/DevLogin';
import { DailyMatching } from './components/matching/DailyMatching';
import { ChatSession } from './components/chat/ChatSession';
import { api } from './services/api';

function AppContent() {
  const { user, loading, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Handle auth parameters from backend redirects
  useEffect(() => {
    console.log('AppContent useEffect triggered. Location:', window.location.href);
    console.log('location.search:', location.search);

    const searchParams = new URLSearchParams(location.search);
    const authStatus = searchParams.get('auth');
    const token = searchParams.get('token');

    console.log('authStatus:', authStatus);

    // Prevent infinite loop: only process auth parameters once
    // Use sessionStorage to persist across component remounts after navigate()
    const sessionKey = 'app_auth_processed';
    if (!authStatus || sessionStorage.getItem(sessionKey)) {
      return;
    }

    sessionStorage.setItem(sessionKey, 'true');

    if (authStatus === 'success') {
      console.log('Auth success detected, refreshing user state');
      console.log('About to call refreshUser()...');

      // Store token if provided
      if (token) {
        localStorage.setItem('auth_token', token);
        console.log('Token stored in localStorage');
      }

      // Ensure token storage completes before refreshing user
      Promise.resolve().then(() => refreshUser()).then(() => {
        console.log('refreshUser() completed. About to navigate...');
        console.log('Current URL before navigate:', window.location.href);

        // Clean up URL parameters - explicitly remove auth params
        const newSearchParams = new URLSearchParams(location.search);
        newSearchParams.delete('auth');
        newSearchParams.delete('token');
        const newSearch = newSearchParams.toString();

        // Clean up sessionStorage guard after successful processing
        sessionStorage.removeItem(sessionKey);

        navigate(location.pathname + (newSearch ? `?${newSearch}` : ''), { replace: true });

        console.log('navigate() called. URL should be cleaned.');
      }).catch((error) => {
        console.error('refreshUser() failed:', error);
        // Still clean up URL even if refresh fails
        const newSearchParams = new URLSearchParams(location.search);
        newSearchParams.delete('auth');
        newSearchParams.delete('token');
        const newSearch = newSearchParams.toString();

        // Clean up sessionStorage guard even on error
        sessionStorage.removeItem(sessionKey);

        navigate(location.pathname + (newSearch ? `?${newSearch}` : ''), { replace: true });
      });
    } else if (authStatus === 'error') {
      const errorType = searchParams.get('type');
      console.error('Auth error detected:', errorType);
      console.log('Cleaning up error URL...');
      // Clean up URL parameters - explicitly remove auth params
      const newSearchParams = new URLSearchParams(location.search);
      newSearchParams.delete('auth');
      newSearchParams.delete('type');
      const newSearch = newSearchParams.toString();

      // Clean up sessionStorage guard after error handling
      sessionStorage.removeItem(sessionKey);

      navigate(location.pathname + (newSearch ? `?${newSearch}` : ''), { replace: true });
    }

    console.log('AppContent useEffect finished.');
  }, [location.search, location.pathname, navigate, refreshUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                三人行必有我師論壇
              </h1>
              {api.isDevMode && (
                <span className="ml-3 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                  開發模式
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <LoginButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Development Mode Login */}
        {api.isDevMode && !user && <DevLogin />}
        
        {!user ? (
          // Landing page for non-authenticated users
          <div className="text-center py-12">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
              歡迎來到三人行必有我師論壇
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              使用您的階級卡驗證身份，加入專屬論壇與同等級的夥伴交流
            </p>
            <div className="bg-white rounded-lg shadow p-8 max-w-md mx-auto">
              <h3 className="text-lg font-semibold mb-4">開始使用</h3>
              {api.isDevMode ? (
                <p className="text-gray-600 mb-6">
                  開發模式：請使用上方的 Mock 登入功能
                </p>
              ) : (
                <>
                  <p className="text-gray-600 mb-6">
                    請先登入以存取論壇功能
                  </p>
                  <LoginButton />
                </>
              )}
            </div>
          </div>
        ) : (
          // Dashboard for authenticated users
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - User info and VC verification */}
            <div className="lg:col-span-1 space-y-6">
              <UserProfile />
              {user.status === 'GENERAL' && <VCVerification />}
              <DailyMatching />
            </div>

            {/* Right column - Forums and features */}
            <div className="lg:col-span-2 space-y-6">
              <ForumList />
              
              {/* Feature showcase for general members */}
              {user.status === 'GENERAL' && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                  <h2 className="text-xl font-semibold text-blue-900 mb-4">
                    解鎖更多功能
                  </h2>
                  <div className="space-y-3 text-blue-800">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      存取專屬等級論壇
                    </div>
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      每日隨機配對聊天
                    </div>
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      私人聊天邀請功能
                    </div>
                  </div>
                  <p className="text-sm text-blue-700 mt-4">
                    驗證您的階級卡即可解鎖所有功能！
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            © 2025 三人行必有我師論壇. 使用 Cloudflare Workers 和 Verifiable Credentials 技術構建.
            {api.isDevMode && (
              <span className="block mt-1 text-yellow-600">
                🚧 開發模式 - Mock 認證已啟用
              </span>
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * OIDC Callback Handler Component
 *
 * Handles the return from SSO provider after successful authentication.
 * When user is redirected back to /api/auth/callback:
 * 1. Checks URL parameters (success/error) from backend redirect
 * 2. Shows a loading indicator
 * 3. Calls refreshUser() to fetch updated authentication state
 * 4. Redirects to main dashboard (/)
 *
 * This solves the issue where backend returns JSON but frontend
 * needs to update auth state and show the main UI.
 *
 * Infinite Loop Prevention:
 * - Uses useRef to track if callback has been processed
 * - Only runs once per mount, even if dependencies change
 * - No dependencies in useEffect to prevent re-triggering
 */
function OIDCCallback() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(true);
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent infinite loop: only process callback once per session
    // Use sessionStorage to persist across React Strict Mode remounts
    const sessionKey = `oidc_callback_processed_${location.pathname}`;
    if (hasProcessed.current || sessionStorage.getItem(sessionKey)) {
      return;
    }
    hasProcessed.current = true;
    sessionStorage.setItem(sessionKey, 'true');

    const handleCallback = async () => {
      try {
        setIsProcessing(true);

        // Check URL parameters for success/error indicators from backend
        const searchParams = new URLSearchParams(location.search);
        const hasError = searchParams.get('error');
        const hasSuccess = searchParams.get('success');

        if (hasError) {
          console.error('OIDC authentication error:', hasError);
          // Continue to refresh user state - backend may have partial auth data
        }

        if (hasSuccess) {
          console.log('OIDC authentication successful');
        }

        // Refresh user state to get updated authentication info
        // This is necessary even on error to sync frontend state with backend
        await refreshUser();
      } catch (error) {
        console.error('Failed to refresh user after OIDC callback:', error);
        // Don't retry - prevent infinite loop on persistent errors
      } finally {
        setIsProcessing(false);
        // Clean up session storage key
        const sessionKey = `oidc_callback_processed_${location.pathname}`;
        sessionStorage.removeItem(sessionKey);
        // Redirect to main dashboard regardless of success/failure
        // If auth failed, user will see login page; if succeeded, they'll see their dashboard
        navigate('/', { replace: true });
      }
    };

    handleCallback();
    // Empty dependency array - run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
        <p className="text-gray-600">處理登入回應中...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<AppContent />} />
          <Route path="/api/auth/callback" element={<OIDCCallback />} />
          <Route path="/chat/session/:sessionId" element={<ChatSession />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
