import { logger } from "../../utils/logger";
import React, { useState, useEffect } from 'react';
import { api, MockUser } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { getRankDisplayName } from '../../utils/rankUtils';

export function DevLogin() {
  const { refreshUser } = useAuth();
  const [mockUsers, setMockUsers] = useState<MockUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Add test user for VC verification
  const testUser = {
    id: 'test-user-need-vc',
    oidcSubjectId: 'mockuser@test.com',
    nickname: 'Mock Test User (需要驗證)',
    status: 'GENERAL' as const,
    rank: undefined
  };

  useEffect(() => {
    loadMockUsers();
  }, []);

  const loadMockUsers = async () => {
    try {
      const response = await api.getMockUsers();
      if (response.data?.users) {
        setMockUsers(response.data.users);
      }
    } catch (error) {
      logger.error('Failed to load mock users:', error);
    }
  };

  const handleTestUserLogin = async () => {
    setLoading(true);
    try {
      // For mock auth, we just need to set the mock user ID
      // The backend will handle authentication via X-Mock-User-Id header
      localStorage.setItem('mockUserId', testUser.id);
      localStorage.removeItem('authToken'); // Remove any existing token
      
      await refreshUser();
      logger.log('Test user logged in successfully');
    } catch (error) {
      logger.error('Test login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMockLogin = async (userId: string) => {
    setLoading(true);
    try {
      // Use the same mock auth approach as test user
      localStorage.setItem('mockUserId', userId);
      localStorage.removeItem('auth_token'); // Remove any existing token
      
      await refreshUser();
      logger.log('Mock login successful for user:', userId);
    } catch (error) {
      logger.error('Mock login failed:', error);
      alert('登入失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const response = await api.seedTestData();
      if (response.error) {
        throw new Error(response.error);
      }
      alert('測試資料建立成功！');
    } catch (error) {
      logger.error('Seed data failed:', error);
      alert('測試資料建立失敗：' + (error instanceof Error ? error.message : '未知錯誤'));
    } finally {
      setSeeding(false);
    }
  };

  if (!api.isDevMode) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center mb-3">
        <svg className="h-4 w-4 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <h3 className="text-sm font-medium text-blue-800">開發模式</h3>
      </div>
      
      <div className="space-y-3">
        {/* Test User for VC Verification */}
        <div className="bg-white border border-blue-200 rounded p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-800">{testUser.nickname}</span>
              <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                {testUser.status}
              </span>
            </div>
            <button
              onClick={handleTestUserLogin}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '登入中...' : '登入測試'}
            </button>
          </div>
        </div>

        {/* Mock Users - Hidden since they don't exist in database */}
        {false && mockUsers.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium text-blue-700">其他測試用戶:</span>
            {mockUsers.map((user) => (
              <div key={user.id} className="bg-white border border-gray-200 rounded p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-700">{user.nickname}</span>
                    <span className="ml-2 text-xs text-gray-500">({user.status})</span>
                    {user.rank && (
                      <span className="ml-2 text-xs bg-gray-200 text-gray-800 px-2 py-0.5 rounded">
                        {getRankDisplayName(user.rank)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleMockLogin(user.id)}
                    disabled={loading}
                    className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? '登入中...' : '登入'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Utilities */}
        <div className="pt-2 border-t border-blue-200">
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {seeding ? '初始化中...' : '初始化測試數據'}
          </button>
        </div>
      </div>
    </div>
  );
}
