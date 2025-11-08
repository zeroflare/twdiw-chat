import React, { useState, useEffect } from 'react';
import { api, MockUser } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

export function DevLogin() {
  const { refreshUser } = useAuth();
  const [mockUsers, setMockUsers] = useState<MockUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

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
      console.error('Failed to load mock users:', error);
    }
  };

  const handleMockLogin = async (userId: string) => {
    setLoading(true);
    try {
      const response = await api.mockLogin(userId);
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Refresh user data
      await refreshUser();
      alert('Mock login successful!');
    } catch (error) {
      console.error('Mock login failed:', error);
      alert('Mock login failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
      alert('Test data seeded successfully!');
    } catch (error) {
      console.error('Seed data failed:', error);
      alert('Seed data failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSeeding(false);
    }
  };

  if (!api.isDevMode) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex items-center mb-3">
        <svg className="h-5 w-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <h3 className="text-lg font-medium text-yellow-800">開發模式</h3>
      </div>
      
      <p className="text-sm text-yellow-700 mb-4">
        您正在使用開發模式。選擇一個測試用戶進行 Mock 登入，無需 OIDC 驗證。
      </p>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-yellow-800">測試數據:</span>
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
          >
            {seeding ? '初始化中...' : '初始化測試數據'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mockUsers.map((user) => (
            <div key={user.id} className="bg-white border border-yellow-200 rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{user.nickname}</div>
                  <div className="text-sm text-gray-500">
                    {user.status === 'VERIFIED' ? (
                      <span className="text-green-600">已驗證 - {user.rank}</span>
                    ) : (
                      <span className="text-yellow-600">一般會員</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleMockLogin(user.id)}
                  disabled={loading}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? '登入中...' : '登入'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-yellow-600 mt-3">
          💡 提示: 選擇不同等級的用戶來測試論壇存取權限
        </div>
      </div>
    </div>
  );
}
