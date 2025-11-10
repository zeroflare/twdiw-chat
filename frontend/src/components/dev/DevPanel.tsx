import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { DevLogin } from '../auth/DevLogin';

export function DevPanel() {
  const { user } = useAuth();
  const [showMockLogin, setShowMockLogin] = useState(false);

  if (user) {
    return null; // Don't show dev panel when user is logged in
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <h3 className="text-lg font-semibold text-yellow-800 mb-3">
        🛠️ 開發測試面板
      </h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-yellow-700">
            選擇認證方式進行測試：
          </span>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => setShowMockLogin(false)}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              !showMockLogin 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            真實 OIDC 登入
          </button>
          
          <button
            onClick={() => setShowMockLogin(true)}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              showMockLogin 
                ? 'bg-orange-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Mock 用戶登入
          </button>
        </div>
        
        {showMockLogin && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded">
            <p className="text-sm text-orange-700 mb-3">
              使用 Mock 用戶快速測試功能：
            </p>
            <DevLogin />
          </div>
        )}
        
        {!showMockLogin && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-700 mb-2">
              ✅ 真實 OIDC 模式已啟用
            </p>
            <p className="text-xs text-blue-600">
              點擊上方「登入 / 註冊」按鈕進行真實 OIDC 認證測試
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
