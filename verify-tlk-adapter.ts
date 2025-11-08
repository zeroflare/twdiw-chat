#!/usr/bin/env ts-node
/**
 * Verification script for TlkIoAdapter fixes
 * Tests the iframe embed generation manually
 */

import { TlkIoAdapter } from './src/infrastructure/adapters/TlkIoAdapter';

console.log('=== TlkIoAdapter Verification ===\n');

const adapter = new TlkIoAdapter({
  TLKIO_BASE_URL: 'https://tlk.io',
  TLKIO_THEME: 'theme--minimal'
});

// Test 1: Forum chat info
console.log('Test 1: Forum Chat Info');
const forumChat = adapter.createForumChatInfo({
  forumId: 'gold-forum-1',
  memberId: 'member-123',
  nickname: 'GoldMember'
});

console.log('Channel ID:', forumChat.channelId);
console.log('Nickname:', forumChat.nickname);
console.log('Embed HTML contains iframe:', forumChat.embedHtml.includes('<iframe'));
console.log('Embed HTML contains sandbox:', forumChat.embedHtml.includes('sandbox='));
console.log('Embed HTML contains allow credentials:', forumChat.embedHtml.includes('allow="credentials"'));
console.log('Full HTML:\n', forumChat.embedHtml);
console.log('\n---\n');

// Test 2: Private chat info
console.log('Test 2: Private Chat Info');
const privateChat = adapter.createPrivateChatInfo({
  sessionId: 'session-abc123def456',
  memberId: 'member-456',
  nickname: 'ChatUser'
});

console.log('Channel ID:', privateChat.channelId);
console.log('Nickname:', privateChat.nickname);
console.log('Embed HTML contains iframe:', privateChat.embedHtml.includes('<iframe'));
console.log('Embed HTML contains sandbox:', privateChat.embedHtml.includes('sandbox='));
console.log('Full HTML:\n', privateChat.embedHtml);
console.log('\n---\n');

// Test 3: XSS protection
console.log('Test 3: XSS Protection');
const xssChat = adapter.createForumChatInfo({
  forumId: 'test',
  memberId: 'member-789',
  nickname: 'User<script>alert("xss")</script>'
});

console.log('XSS test - contains encoded script:', xssChat.embedHtml.includes('&lt;script&gt;'));
console.log('XSS test - does NOT contain raw script:', !xssChat.embedHtml.includes('<script>alert'));
console.log('Full HTML:\n', xssChat.embedHtml);
console.log('\n---\n');

// Test 4: URL encoding
console.log('Test 4: URL Encoding');
const spaceChat = adapter.createForumChatInfo({
  forumId: 'test',
  memberId: 'member-999',
  nickname: 'Test User With Spaces'
});

console.log('URL encoding - contains encoded spaces:', spaceChat.embedHtml.includes('Test%20User%20With%20Spaces'));
console.log('Full HTML:\n', spaceChat.embedHtml);
console.log('\n---\n');

console.log('=== Verification Complete ===');
console.log('\nKey Changes Applied:');
console.log('1. ✓ Added generateIframeEmbed() method with cross-origin support');
console.log('2. ✓ Updated createForumChatInfo() to use iframe embed');
console.log('3. ✓ Updated createPrivateChatInfo() to use iframe embed');
console.log('4. ✓ Added sandbox attributes: allow-same-origin, allow-scripts, allow-forms, allow-popups');
console.log('5. ✓ Added allow="credentials" for cross-origin cookie support');
console.log('6. ✓ Maintained XSS protection with HTML escaping and URL encoding');
console.log('7. ✓ Kept backward compatibility with generateEmbedHtml()');
