import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api, Forum } from '../../services/api';

// Forum name mapping based on rank requirements
const FORUM_NAMES: Record<string, string> = {
  'EARTH_OL_GRADUATE': '地表頂級投資俱樂部 👑',
  'LIFE_WINNER_S': '人生勝利組研習社 🏆', 
  'QUASI_WEALTHY_VIP': '準富豪交流會 💼',
  'DISTINGUISHED_PETTY': '小資族奮鬥基地 ☕',
  'NEWBIE_VILLAGE': '新手村薪水冒險團 🌱'
};

// Use backend-provided accessible property instead of frontend logic

export function ForumList() {
  const { user } = useAuth();
  const [forums, setForums] = useState<Forum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningForum, setJoiningForum] = useState<string | null>(null);

  useEffect(() => {
    loadForums();
  }, []);

  const loadForums = async () => {
    try {
      const response = await api.getForums();
      if (response.error) {
        throw new Error(response.error);
      }
      // Handle nested forums structure from API
      const forumsData = response.data?.forums || response.data || [];
      setForums(Array.isArray(forumsData) ? forumsData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入論壇失敗');
    } finally {
      setLoading(false);
    }
  };

  const joinForum = async (forumId: string) => {
    setJoiningForum(forumId);
    try {
      const response = await api.joinForum(forumId);
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Open chat in new window/tab
      const chatWindow = window.open('', '_blank', 'width=800,height=600');
      if (chatWindow) {
        chatWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>論壇聊天室</title>
            <meta charset="utf-8">
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .header { margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
              .forum-info { background: #f5f5f5; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>論壇聊天室</h2>
              <div class="forum-info">
                <strong>論壇:</strong> ${response.data?.forumInfo.description}<br>
                <strong>暱稱:</strong> ${response.data?.nickname}
              </div>
            </div>
            <div id="tlkio" data-channel="${response.data?.channelId}" data-nickname="${response.data?.nickname}" style="width:100%;height:400px;"></div>
            <script async src="https://tlk.io/embed.js" type="text/javascript"></script>
          </body>
          </html>
        `);
        chatWindow.document.close();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '加入論壇失敗');
    } finally {
      setJoiningForum(null);
    }
  };

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">論壇</h2>
        <p className="text-gray-600">請先登入以查看論壇。</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">論壇</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <span className="ml-2 text-gray-600">載入中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">論壇</h2>
        <div className="text-red-600 text-center py-4">
          <p>{error}</p>
          <button 
            onClick={loadForums}
            className="mt-2 px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600"
          >
            重新載入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">論壇</h2>
      
      {user.status === 'GENERAL' && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-700">
            💡 驗證您的階級卡以存取專屬論壇！
          </p>
        </div>
      )}
      
      <div className="space-y-4">
        {forums.map((forum) => {
          const hasAccess = user.status === 'VERIFIED' && forum.accessible;
          const isJoining = joiningForum === forum.id;
          
          return (
            <div key={forum.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-semibold">{FORUM_NAMES[forum.requiredRank] || '未知論壇'}</h3>
                    <span className="text-sm text-gray-500">
                      {forum.memberCount} 位成員
                    </span>
                  </div>
                  <p className="text-gray-700">{forum.description}</p>
                </div>
                
                <div className="ml-4">
                  {hasAccess ? (
                    <button
                      onClick={() => joinForum(forum.id)}
                      disabled={isJoining}
                      className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 disabled:opacity-50"
                    >
                      {isJoining ? '加入中...' : '進入聊天室'}
                    </button>
                  ) : (
                    <div className="text-sm text-gray-500">
                      {user.status === 'GENERAL' ? '需要驗證' : '無法進入'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {forums.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>目前沒有可用的論壇</p>
          </div>
        )}
      </div>
    </div>
  );
}
