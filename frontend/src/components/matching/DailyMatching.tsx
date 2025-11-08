import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';

export function DailyMatching() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [matchStatus, setMatchStatus] = useState<'idle' | 'waiting' | 'matched'>('idle');
  const [matchInfo, setMatchInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkMatchStatus();
  }, []);

  const checkMatchStatus = async () => {
    try {
      const response = await api.request('/chat/match/status');
      if (response.data?.status === 'matched') {
        setMatchStatus('matched');
        setMatchInfo(response.data);
      } else if (response.data?.status === 'waiting') {
        setMatchStatus('waiting');
      }
    } catch (err) {
      // No active match
      setMatchStatus('idle');
    }
  };

  const requestMatch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.request('/chat/match', { method: 'POST' });
      
      if (response.error) {
        setError(response.error);
      } else if (response.data?.status === 'waiting') {
        setMatchStatus('waiting');
      } else if (response.data?.sessionId) {
        setMatchStatus('matched');
        setMatchInfo(response.data);
      }
    } catch (err) {
      setError('配對請求失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const cancelMatch = async () => {
    try {
      await api.request('/chat/match', { method: 'DELETE' });
      setMatchStatus('idle');
      setMatchInfo(null);
      setError(null);
    } catch (err) {
      setError('取消配對失敗');
    }
  };

  if (user?.status !== 'VERIFIED') {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">每日配對</h3>
        <p className="text-gray-600">
          請先驗證您的階級卡以使用每日配對功能
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">每日配對</h3>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {matchStatus === 'idle' && (
        <div>
          <p className="text-gray-600 mb-4">
            與同等級的夥伴進行一對一私人對話
          </p>
          <button
            onClick={requestMatch}
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? '尋找配對中...' : '開始配對'}
          </button>
        </div>
      )}

      {matchStatus === 'waiting' && (
        <div>
          <p className="text-yellow-700 mb-4">
            🔍 正在尋找合適的配對夥伴...
          </p>
          <button
            onClick={cancelMatch}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            取消配對
          </button>
        </div>
      )}

      {matchStatus === 'matched' && matchInfo && (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-green-700 font-medium">✅ 配對成功！</p>
            {matchInfo.matchedWith && (
              <p className="text-green-600 text-sm mt-1">
                與 {matchInfo.matchedWith.nickname} ({matchInfo.matchedWith.rank}) 配對
              </p>
            )}
          </div>
          <button
            onClick={() => navigate(`/chat/session/${matchInfo.sessionId}`)}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            開始對話
          </button>
        </div>
      )}
    </div>
  );
}
