import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const UserSetup: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [gender, setGender] = useState('');
  const [interests, setInterests] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gender || !interests.trim()) {
      setError('請填寫所有必填欄位');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Update user profile
      const response = await api.updateProfile({ gender, interests });
      if (response.error) {
        setError(response.error);
      } else {
        // Refresh user data to get updated profile
        await refreshUser();
      }
    } catch (err) {
      setError('更新失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">完善個人資料</h2>
          <p className="text-gray-600 mt-2">
            歡迎 {user?.nickname}！請完善您的個人資料以開始使用論壇
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              性別 *
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">請選擇性別</option>
              <option value="Male">男性</option>
              <option value="Female">女性</option>
              <option value="Other">其他</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              興趣愛好 *
            </label>
            <textarea
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="請描述您的興趣愛好..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? '更新中...' : '完成設定'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserSetup;
