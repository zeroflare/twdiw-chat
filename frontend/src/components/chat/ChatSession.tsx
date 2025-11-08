import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

interface SessionInfo {
  id: string;
  type: string;
  expiresAt: number;
  createdAt: number;
  otherMemberId: string;
}

interface ChatData {
  channelId: string;
  embedHtml: string;
  nickname: string;
  sessionInfo: SessionInfo;
}

export function ChatSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }

    loadChatSession();
  }, [sessionId]);

  useEffect(() => {
    // Load tlk.io script when chat data is available
    if (chatData) {
      console.log('ChatSession: Loading tlk.io script...');
      
      // Set a small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        // Check if script already exists
        const existingScript = document.querySelector('script[src*="tlk.io"]');
        console.log('Existing script found:', !!existingScript);
        
        if (!existingScript) {
          console.log('Creating new tlk.io script...');
          const script = document.createElement('script');
          script.src = 'https://tlk.io/embed.js';
          script.async = true;
          script.onload = () => {
            console.log('tlk.io script loaded successfully');
            // Trigger load event after script loads
            setTimeout(() => {
              console.log('Auto-triggering load event...');
              window.dispatchEvent(new Event('load'));
            }, 100);
          };
          script.onerror = () => console.log('tlk.io script failed to load');
          document.head.appendChild(script);
          console.log('Script added to head');
        }
        
        // Check if div exists
        const tlkDiv = document.getElementById('tlkio');
        console.log('tlkio div found:', !!tlkDiv);
        if (tlkDiv) {
          console.log('tlkio div attributes:', {
            channel: tlkDiv.getAttribute('data-channel'),
            theme: tlkDiv.getAttribute('data-theme'),
            nickname: tlkDiv.getAttribute('data-nickname')
          });
        } else {
          // Manually create div if not found
          console.log('Creating tlkio div manually...');
          const container = document.querySelector('.w-full');
          if (container) {
            container.innerHTML = `<div id="tlkio" data-channel="${chatData.channelId}" data-theme="theme--minimal" data-nickname="${chatData.nickname}" style="width:100%;height:400px;"></div>`;
            console.log('Manual div created');
          }
        }
        
        setChatLoading(false);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [chatData]);

  const loadChatSession = async () => {
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
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-TW');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">載入聊天室中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-50">
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
            {chatLoading ? (
              <div className="flex items-center justify-center h-96 border border-gray-200 rounded bg-gray-50">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p className="text-gray-600">載入聊天室中...</p>
                </div>
              </div>
            ) : (
              <>
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: chatData.embedHtml.split('<script')[0] // Only use div part, not script
                  }}
                  className="w-full"
                />
                <div className="mt-2 text-xs text-gray-400">
                  <p>HTML內容: {chatData.embedHtml.split('<script')[0]}</p>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-500">
                    如果聊天室沒有載入，請嘗試重新整理頁面
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    頻道ID: {chatData.channelId}
                  </p>
                  <details className="mt-2">
                    <summary className="text-xs text-gray-400 cursor-pointer">調試信息</summary>
                    <pre className="text-xs text-gray-400 mt-1 text-left bg-gray-100 p-2 rounded">
                      {JSON.stringify(chatData, null, 2)}
                    </pre>
                  </details>
                </div>
              </>
            )}
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
