import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

interface SessionInfo {
  id: string;
  type: string;
  expiresAt: number;
  createdAt: number;
  otherMemberId: string;
}

interface ChatData {
  channelId: string;
  nickname: string;
  sessionInfo: SessionInfo;
}

export function ChatSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isRequestingRef = useRef(false); // Prevent duplicate requests

  const loadChatSession = useCallback(async () => {
    if (!sessionId || isRequestingRef.current) {
      return;
    }

    isRequestingRef.current = true;
    try {
      const response = await api.request(`/chat/session/${sessionId}`);

      if (response.error) {
        setError(response.error);
      } else {
        setChatData(response.data);
      }
    } catch (err) {
      setError('無法載入聊天會話');
    } finally {
      setLoading(false);
      isRequestingRef.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }

    // Reset state when sessionId changes to prevent stale data
    setLoading(true);
    setError(null);
    setChatData(null);

    loadChatSession();

    // Cleanup function to handle component unmount or sessionId change
    return () => {
      // Clear any pending state updates or side effects
      // This prevents memory leaks and DOM conflicts
      setLoading(false);
      setError(null);
      setChatData(null);
    };
  }, [sessionId, navigate, loadChatSession]);

  // Load tlk.io script when chat data is available
  useEffect(() => {
    if (!chatData) return;

    // Clear tlk.io related cookies and storage to prevent session conflicts
    const clearTlkIoSession = () => {
      // Clear cookies
      document.cookie.split(";").forEach(cookie => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        if (name.toLowerCase().includes('tlk')) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.tlk.io`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        }
      });

      // Clear localStorage and sessionStorage
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.toLowerCase().includes('tlk')) {
            localStorage.removeItem(key);
          }
        });
        Object.keys(sessionStorage).forEach(key => {
          if (key.toLowerCase().includes('tlk')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.log('Storage cleanup failed:', e);
      }
    };

    // Clear session before loading
    clearTlkIoSession();

    // Wait for DOM to be ready
    setTimeout(() => {
      // Check if script is already loaded
      const existingScript = document.querySelector('script[src*="tlk.io/embed.js"]');
      
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://tlk.io/embed.js';
        script.async = true;
        
        script.onload = () => {
          // Trigger tlk.io initialization after script loads
          setTimeout(() => {
            window.dispatchEvent(new Event('load'));
          }, 100);
        };
        
        document.head.appendChild(script);
      } else {
        // Script exists, just trigger initialization
        setTimeout(() => {
          window.dispatchEvent(new Event('load'));
        }, 100);
      }
    }, 50);
  }, [chatData]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-TW');
  };

  // Use oidcSubjectId as key to force component remount when member switches
  // This prevents nickname cache issues and ensures clean state
  const componentKey = user?.oidcSubjectId || 'no-user';
  
  // Debug logging
  console.log('ChatSession Debug:', {
    userOidcSubjectId: user?.oidcSubjectId,
    userId: user?.id,
    componentKey,
    sessionId
  });

  if (loading) {
    return (
      <div key={componentKey} className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">載入聊天室中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div key={componentKey} className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-800 mb-2">無法載入聊天室</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
            >
              返回首頁
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!chatData) {
    return null;
  }

  return (
    <div key={componentKey} className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">私人聊天</h1>
              <p className="text-sm text-gray-600">
                會話類型: {chatData.sessionInfo.type === 'DAILY_MATCH' ? '每日配對' : '群組聊天'}
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              返回首頁
            </button>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow">
          {/* Session Info */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>開始時間: {formatTime(chatData.sessionInfo.createdAt)}</span>
              <span>過期時間: {formatTime(chatData.sessionInfo.expiresAt)}</span>
            </div>
          </div>

          {/* Chat Embed */}
          <div className="p-6">
            <div className="mb-2 text-sm text-gray-600">
              當前用戶: <span className="font-medium text-blue-600">{chatData.nickname}</span>
            </div>
            <div 
              id="tlkio" 
              data-channel={chatData.channelId} 
              data-nickname={chatData.nickname}
              style={{width: '100%', height: '400px'}}
            ></div>
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                如果聊天室沒有載入，請嘗試重新整理頁面
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">聊天室使用說明</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 這是一個私人聊天室，只有配對的雙方可以看到</li>
            <li>• 聊天記錄會在會話過期後自動清除</li>
            <li>• 請保持友善和尊重的對話</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
