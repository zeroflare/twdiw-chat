import React from 'react';
import { useAuth } from '../../hooks/useAuth';

const getRankColor = (rank?: string) => {
  switch (rank) {
    case 'Gold': return 'text-yellow-500';
    case 'Silver': return 'text-gray-400';
    case 'Bronze': return 'text-orange-600';
    default: return 'text-gray-500';
  }
};

const getRankBadge = (rank?: string) => {
  switch (rank) {
    case 'Gold': return 'bg-yellow-100 text-yellow-800';
    case 'Silver': return 'bg-gray-100 text-gray-800';
    case 'Bronze': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-600';
  }
};

export function UserProfile() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">個人資料</h2>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">暱稱</label>
          <p className="mt-1 text-sm text-gray-900">{user.nickname}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">會員狀態</label>
          <div className="mt-1">
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              user.status === 'VERIFIED' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {user.status === 'VERIFIED' ? '已驗證會員' : '一般會員'}
            </span>
          </div>
        </div>

        {user.rank && (
          <div>
            <label className="block text-sm font-medium text-gray-700">等級</label>
            <div className="mt-1">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRankBadge(user.rank)}`}>
                {user.rank}
              </span>
            </div>
          </div>
        )}

        {user.linkedVcDid && (
          <div>
            <label className="block text-sm font-medium text-gray-700">VC DID</label>
            <p className="mt-1 text-xs text-gray-500 font-mono break-all">
              {user.linkedVcDid}
            </p>
          </div>
        )}
      </div>

      {user.status === 'GENERAL' && (
        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-700">
            💡 驗證您的階級卡以解鎖更多功能和專屬論壇！
          </p>
        </div>
      )}
    </div>
  );
}
