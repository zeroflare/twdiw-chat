/**
 * Manual verification script for TlkIoAdapter iframe loading fix
 */
import { TlkIoAdapter } from './src/infrastructure/adapters/TlkIoAdapter';

const adapter = new TlkIoAdapter({
  TLKIO_BASE_URL: 'https://tlk.io',
  TLKIO_THEME: 'theme--minimal'
});

console.log('=== Testing TlkIoAdapter iframe loading fix ===\n');

// Test 1: Generate iframe for forum chat
console.log('Test 1: Forum chat iframe');
const forumEmbed = adapter.generateIframeEmbed('forum-test123', 'TestUser');
console.log(forumEmbed);
console.log('');

// Verify key features
console.log('✓ Checks:');
console.log('  - Has onload handler:', forumEmbed.includes('onload='));
console.log('  - Has loading attribute:', forumEmbed.includes('loading="lazy"'));
console.log('  - Has container div:', forumEmbed.includes('<div') && forumEmbed.includes('</div>'));
console.log('  - Has unique ID:', forumEmbed.includes('id="tlk-iframe-forum-test123"'));
console.log('  - Has loading state:', forumEmbed.includes('data-loading-state'));
console.log('  - Has sandbox attrs:', forumEmbed.includes('sandbox="allow-same-origin allow-scripts allow-forms allow-popups"'));
console.log('  - Has credentials:', forumEmbed.includes('allow="credentials"'));
console.log('');

// Test 2: Generate different iframes for different channels
console.log('Test 2: Different channels generate unique IDs');
const embed1 = adapter.generateIframeEmbed('forum-abc', 'User1');
const embed2 = adapter.generateIframeEmbed('forum-xyz', 'User2');
console.log('  - Embed 1 has unique ID:', embed1.includes('id="tlk-iframe-forum-abc"'));
console.log('  - Embed 2 has unique ID:', embed2.includes('id="tlk-iframe-forum-xyz"'));
console.log('  - IDs are different:', embed1 !== embed2);
console.log('');

// Test 3: Full integration test
console.log('Test 3: Full forum chat info');
const chatInfo = adapter.createForumChatInfo({
  forumId: 'gold-forum-1',
  memberId: 'member-123',
  nickname: 'GoldMember'
});
console.log('  - Channel ID:', chatInfo.channelId);
console.log('  - Nickname:', chatInfo.nickname);
console.log('  - Has iframe wrapper:', chatInfo.embedHtml.includes('<div class="tlk-iframe-container"'));
console.log('');

console.log('=== All manual checks complete ===');
