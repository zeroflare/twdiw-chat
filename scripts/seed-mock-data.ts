/**
 * Seed script to populate database with mock users for testing
 * Run with: npx tsx scripts/seed-mock-data.ts
 */

import { Rank } from '../src/domain/entities/MemberProfile';

const mockUsers = [
  {
    id: 'user-1',
    oidcSubjectId: 'mock-oidc-1',
    nickname: '測試用戶 (一般)',
    status: 'GENERAL',
    derived_rank: null
  },
  {
    id: 'user-2',
    oidcSubjectId: 'mock-oidc-2', 
    nickname: '地球OL財富畢業證書持有者',
    status: 'VERIFIED',
    derived_rank: Rank.EARTH_OL_GRADUATE
  },
  {
    id: 'user-3',
    oidcSubjectId: 'mock-oidc-3',
    nickname: '人生勝利組S級玩家',
    status: 'VERIFIED', 
    derived_rank: Rank.LIFE_WINNER_S
  },
  {
    id: 'user-4',
    oidcSubjectId: 'mock-oidc-4',
    nickname: '準富豪VIP會員',
    status: 'VERIFIED',
    derived_rank: Rank.QUASI_WEALTHY_VIP
  },
  {
    id: 'user-5',
    oidcSubjectId: 'mock-oidc-5',
    nickname: '尊爵不凡小資族',
    status: 'VERIFIED',
    derived_rank: Rank.DISTINGUISHED_PETTY
  },
  {
    id: 'user-6',
    oidcSubjectId: 'mock-oidc-6',
    nickname: '新手村榮譽村民',
    status: 'VERIFIED',
    derived_rank: Rank.NEWBIE_VILLAGE
  },
  // Additional users for realistic member counts
  {
    id: 'user-7',
    oidcSubjectId: 'mock-oidc-7',
    nickname: '新手村村民A',
    status: 'VERIFIED',
    derived_rank: Rank.NEWBIE_VILLAGE
  },
  {
    id: 'user-8', 
    oidcSubjectId: 'mock-oidc-8',
    nickname: '新手村村民B',
    status: 'VERIFIED',
    derived_rank: Rank.NEWBIE_VILLAGE
  },
  {
    id: 'user-9',
    oidcSubjectId: 'mock-oidc-9',
    nickname: '小資族成員A',
    status: 'VERIFIED',
    derived_rank: Rank.DISTINGUISHED_PETTY
  },
  {
    id: 'user-10',
    oidcSubjectId: 'mock-oidc-10',
    nickname: '小資族成員B',
    status: 'VERIFIED',
    derived_rank: Rank.DISTINGUISHED_PETTY
  }
];

console.log('Mock users data:');
console.log('INSERT INTO member_profiles (id, oidc_subject_id, status, nickname, derived_rank, version, created_at, updated_at) VALUES');

const now = Date.now();
const values = mockUsers.map(user => 
  `('${user.id}', '${user.oidcSubjectId}', '${user.status}', '${user.nickname}', ${user.derived_rank ? `'${user.derived_rank}'` : 'NULL'}, 1, ${now}, ${now})`
).join(',\n');

console.log(values + ';');

console.log('\n-- Member count by rank:');
console.log(`-- ${Rank.EARTH_OL_GRADUATE}: 1`);
console.log(`-- ${Rank.LIFE_WINNER_S}: 1`);
console.log(`-- ${Rank.QUASI_WEALTHY_VIP}: 1`);
console.log(`-- ${Rank.DISTINGUISHED_PETTY}: 3`);
console.log(`-- ${Rank.NEWBIE_VILLAGE}: 3`);
console.log('-- GENERAL (no rank): 1');
