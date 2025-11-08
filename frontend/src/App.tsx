import React from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoginButton } from './components/auth/LoginButton';
import { UserProfile } from './components/auth/UserProfile';
import { VCVerification } from './components/vc/VCVerification';
import { ForumList } from './components/forum/ForumList';

function AppContent() {
  const { user, loading } = useAuth();

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
            </div>
            <LoginButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
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
              <p className="text-gray-600 mb-6">
                請先登入以存取論壇功能
              </p>
              <LoginButton />
            </div>
          </div>
        ) : (
          // Dashboard for authenticated users
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - User info and VC verification */}
            <div className="lg:col-span-1 space-y-6">
              <UserProfile />
              {user.status === 'GENERAL' && <VCVerification />}
            </div>

            {/* Right column - Forums and features */}
            <div className="lg:col-span-2 space-y-6">
              <ForumList />
              
              {/* Daily Match Feature */}
              {user.status === 'VERIFIED' && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold mb-4">每日配對</h2>
                  <p className="text-gray-600 mb-4">
                    與其他已驗證會員進行隨機配對，開始私人對話
                  </p>
                  <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                    尋找配對
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    每日限制一次配對機會
                  </p>
                </div>
              )}
              
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
          </p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
