-- Migration: 0007_insert_initial_forums
-- Description: Insert initial forum data for all rank levels
-- Security: Uses predefined forum IDs and secure default values

-- Insert forums for each rank level
INSERT OR IGNORE INTO forums (
    id, 
    required_rank, 
    description, 
    tlk_channel_id, 
    capacity, 
    member_count, 
    creator_id, 
    status, 
    version, 
    created_at, 
    updated_at
) VALUES 
-- Earth OL Graduate Forum (Highest tier)
(
    'earth-ol-graduate-forum',
    'EARTH_OL_GRADUATE',
    '頂級投資者的專屬交流空間，分享高端投資策略與財富管理心得',
    'earth-ol-graduate-chat',
    20,
    0,
    'system',
    'ACTIVE',
    1,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
),
-- Life Winner S Forum
(
    'life-winner-s-forum',
    'LIFE_WINNER_S',
    '人生勝利組的聚會所，討論成功經驗與人生規劃',
    'life-winner-s-chat',
    30,
    0,
    'system',
    'ACTIVE',
    1,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
),
-- Quasi Wealthy VIP Forum
(
    'quasi-wealthy-vip-forum',
    'QUASI_WEALTHY_VIP',
    '準富豪們的交流平台，探討財富累積與投資機會',
    'quasi-wealthy-vip-chat',
    50,
    0,
    'system',
    'ACTIVE',
    1,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
),
-- Distinguished Petty Forum
(
    'distinguished-petty-forum',
    'DISTINGUISHED_PETTY',
    '小資族的奮鬥基地，分享理財技巧與職場心得',
    'distinguished-petty-chat',
    100,
    0,
    'system',
    'ACTIVE',
    1,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
),
-- Newbie Village Forum
(
    'newbie-village-forum',
    'NEWBIE_VILLAGE',
    '新手村的溫馨家園，互相鼓勵與學習成長',
    'newbie-village-chat',
    200,
    0,
    'system',
    'ACTIVE',
    1,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);
