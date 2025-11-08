// Rank mapping utilities for displaying Chinese rank names

export const getRankDisplayName = (rank?: string): string => {
  switch (rank) {
    case 'EARTH_OL_GRADUATE': return '地球OL財富畢業證書持有者';
    case 'LIFE_WINNER_S': return '人生勝利組S級玩家';
    case 'QUASI_WEALTHY_VIP': return '準富豪VIP會員';
    case 'DISTINGUISHED_PETTY': return '尊爵不凡小資族';
    case 'NEWBIE_VILLAGE': return '新手村榮譽村民';
    default: return rank || '未知等級';
  }
};

export const getRankColor = (rank?: string): string => {
  switch (rank) {
    case 'EARTH_OL_GRADUATE': return 'text-purple-600';
    case 'LIFE_WINNER_S': return 'text-yellow-500';
    case 'QUASI_WEALTHY_VIP': return 'text-blue-600';
    case 'DISTINGUISHED_PETTY': return 'text-green-600';
    case 'NEWBIE_VILLAGE': return 'text-gray-500';
    default: return 'text-gray-500';
  }
};

export const getRankBadge = (rank?: string): string => {
  switch (rank) {
    case 'EARTH_OL_GRADUATE': return 'bg-purple-100 text-purple-800';
    case 'LIFE_WINNER_S': return 'bg-yellow-100 text-yellow-800';
    case 'QUASI_WEALTHY_VIP': return 'bg-blue-100 text-blue-800';
    case 'DISTINGUISHED_PETTY': return 'bg-green-100 text-green-800';
    case 'NEWBIE_VILLAGE': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-100 text-gray-600';
  }
};
