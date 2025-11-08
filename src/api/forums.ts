/**
 * Forums API Endpoints
 * Handles forum listing and access control
 */

import { Hono } from 'hono';
import { Rank, FORUM_NAMES } from '../domain/entities/Forum';
import { optionalAuthMiddleware } from '../middleware/auth';

const app = new Hono();

// GET /api/forums - List available forums
app.get('/', optionalAuthMiddleware(), async (c) => {
  try {
    const user = c.get('user');
    const userRank = user?.rank || null;

    // Debug logging
    console.log('Forums API Debug:', {
      user,
      userRank,
      userType: typeof user,
      rankType: typeof userRank
    });

    // Query member counts for all ranks (we'll calculate accessible members per forum)
    const allRankCounts = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as count FROM member_profiles WHERE derived_rank = ?')
        .bind(Rank.EARTH_OL_GRADUATE).first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM member_profiles WHERE derived_rank = ?')
        .bind(Rank.LIFE_WINNER_S).first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM member_profiles WHERE derived_rank = ?')
        .bind(Rank.QUASI_WEALTHY_VIP).first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM member_profiles WHERE derived_rank = ?')
        .bind(Rank.DISTINGUISHED_PETTY).first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM member_profiles WHERE derived_rank = ?')
        .bind(Rank.NEWBIE_VILLAGE).first()
    ]);

    const rankCounts = {
      [Rank.EARTH_OL_GRADUATE]: allRankCounts[0]?.count || 0,
      [Rank.LIFE_WINNER_S]: allRankCounts[1]?.count || 0,
      [Rank.QUASI_WEALTHY_VIP]: allRankCounts[2]?.count || 0,
      [Rank.DISTINGUISHED_PETTY]: allRankCounts[3]?.count || 0,
      [Rank.NEWBIE_VILLAGE]: allRankCounts[4]?.count || 0
    };

    const forums = [
      {
        id: 'earth-ol-graduate-forum',
        description: '頂級投資者的專屬交流空間，分享高端投資策略與財富管理心得',
        requiredRank: Rank.EARTH_OL_GRADUATE,
        memberCount: rankCounts[Rank.EARTH_OL_GRADUATE] + rankCounts[Rank.LIFE_WINNER_S],
        capacity: 20,
        accessible: [Rank.EARTH_OL_GRADUATE, Rank.LIFE_WINNER_S].includes(userRank as Rank)
      },
      {
        id: 'life-winner-s-forum', 
        description: '人生勝利組的聚會所，討論成功經驗與人生規劃',
        requiredRank: Rank.LIFE_WINNER_S,
        memberCount: rankCounts[Rank.EARTH_OL_GRADUATE] + rankCounts[Rank.LIFE_WINNER_S] + rankCounts[Rank.QUASI_WEALTHY_VIP],
        capacity: 30,
        accessible: [Rank.EARTH_OL_GRADUATE, Rank.LIFE_WINNER_S, Rank.QUASI_WEALTHY_VIP].includes(userRank as Rank)
      },
      {
        id: 'quasi-wealthy-vip-forum',
        description: '準富豪們的交流平台，探討財富累積與投資機會',
        requiredRank: Rank.QUASI_WEALTHY_VIP,
        memberCount: rankCounts[Rank.LIFE_WINNER_S] + rankCounts[Rank.QUASI_WEALTHY_VIP] + rankCounts[Rank.DISTINGUISHED_PETTY],
        capacity: 50,
        accessible: [Rank.LIFE_WINNER_S, Rank.QUASI_WEALTHY_VIP, Rank.DISTINGUISHED_PETTY].includes(userRank as Rank)
      },
      {
        id: 'distinguished-petty-forum',
        description: '小資族的奮鬥基地，分享理財技巧與職場心得', 
        requiredRank: Rank.DISTINGUISHED_PETTY,
        memberCount: rankCounts[Rank.QUASI_WEALTHY_VIP] + rankCounts[Rank.DISTINGUISHED_PETTY] + rankCounts[Rank.NEWBIE_VILLAGE],
        capacity: 100,
        accessible: [Rank.QUASI_WEALTHY_VIP, Rank.DISTINGUISHED_PETTY, Rank.NEWBIE_VILLAGE].includes(userRank as Rank)
      },
      {
        id: 'newbie-village-forum',
        description: '新手村的溫馨家園，互相鼓勵與學習成長',
        requiredRank: Rank.NEWBIE_VILLAGE,
        memberCount: rankCounts[Rank.DISTINGUISHED_PETTY] + rankCounts[Rank.NEWBIE_VILLAGE],
        capacity: 200,
        accessible: [Rank.DISTINGUISHED_PETTY, Rank.NEWBIE_VILLAGE].includes(userRank as Rank)
      }
    ];

    // Debug each forum's accessibility
    console.log('Forum Accessibility Debug:', forums.map(f => ({
      id: f.id,
      requiredRank: f.requiredRank,
      accessible: f.accessible,
      userRank,
      comparison: `${userRank} in [${f.requiredRank}] = ${f.accessible}`
    })));

    return c.json({ forums });
  } catch (error) {
    console.error('Get forums failed:', error);
    return c.json({ error: 'Failed to get forums' }, 500);
  }
});

export default app;
