import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export function LoginButton() {
  const { user, login, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await login();
    } catch (error) {
      console.error('Login failed:', error);
      alert('登入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-600">
          歡迎, {user.nickname}
        </span>
        <button
          onClick={handleLogout}
          disabled={loading}
          className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
        >
          {loading ? '登出中...' : '登出'}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
    >
      {loading ? '登入中...' : '登入 / 註冊'}
    </button>
  );
}
