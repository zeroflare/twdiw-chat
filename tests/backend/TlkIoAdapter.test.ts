import { describe, it, expect, beforeEach } from 'vitest';
import { TlkIoAdapter } from '../../src/infrastructure/adapters/TlkIoAdapter';

describe('TlkIoAdapter - Cookie/Session Configuration for Embeds', () => {
  let adapter: TlkIoAdapter;

  beforeEach(() => {
    adapter = new TlkIoAdapter({
      TLKIO_BASE_URL: 'https://tlk.io',
      TLKIO_THEME: 'theme--minimal'
    });
  });

  describe('generateEmbedHtml - Cross-Origin Cookie Support', () => {
    it('should generate embed HTML with SameSite=None cookie support for cross-origin iframes', () => {
      const channelId = 'forum-test123';
      const nickname = 'TestUser';
      const embedHtml = adapter['generateEmbedHtml'](channelId, nickname);

      // The embed should include credentials parameter for cross-origin cookies
      expect(embedHtml).toContain('data-credentials="include"');
    });

    it('should include data attributes for script-based embed configuration', () => {
      const channelId = 'forum-test123';
      const nickname = 'TestUser';
      const embedHtml = adapter['generateEmbedHtml'](channelId, nickname);

      // Should not contain iframe yet (script-based embed), but should have data attributes
      // that the tlk.io script will use to configure the iframe correctly
      expect(embedHtml).toContain('data-channel="forum-test123"');
      expect(embedHtml).toContain('data-nickname="TestUser"');
    });

    it('should generate iframe-based embed with proper sandbox attributes', () => {
      const channelId = 'forum-test123';
      const nickname = 'TestUser';

      // Use new iframe-based method to avoid 403 errors
      const embedHtml = adapter.generateIframeEmbed(channelId, nickname);

      // Check for iframe element
      expect(embedHtml).toContain('<iframe');

      // Check for sandbox attributes for security
      expect(embedHtml).toContain('sandbox="allow-same-origin allow-scripts allow-forms allow-popups"');

      // Should NOT contain unsupported 'credentials' in allow attribute
      // Note: 'credentials' is not a valid feature policy value
      expect(embedHtml).not.toMatch(/allow="[^"]*credentials[^"]*"/);

      // Verify the URL includes necessary parameters
      expect(embedHtml).toContain(`https://tlk.io/${channelId}`);
      expect(embedHtml).toContain('nickname=');
    });

    it('should properly encode nickname in URL parameters', () => {
      const channelId = 'forum-test123';
      const nickname = 'Test User With Spaces';

      const embedHtml = adapter.generateIframeEmbed(channelId, nickname);

      // Nickname should be URL-encoded
      expect(embedHtml).toContain('Test%20User%20With%20Spaces');
    });

    it('should escape special characters in attributes to prevent XSS', () => {
      const channelId = 'forum-test123';
      const nickname = 'User<script>alert("xss")</script>';

      const embedHtml = adapter.generateIframeEmbed(channelId, nickname);

      // Should escape < and > characters
      expect(embedHtml).not.toContain('<script>');
      expect(embedHtml).toContain('&lt;script&gt;');
    });
  });

  describe('Forum Chat Channel - Integration', () => {
    it('should create forum chat info with iframe embed HTML', () => {
      const chatInfo = adapter.createForumChatInfo({
        forumId: 'gold-forum-1',
        memberId: 'member-123',
        nickname: 'GoldMember'
      });

      expect(chatInfo.channelId).toBe('forum-gold-forum-1');
      expect(chatInfo.nickname).toBe('GoldMember');
      // Should use iframe embed to avoid 403 errors
      expect(chatInfo.embedHtml).toContain('<iframe');
      expect(chatInfo.embedHtml).toContain('sandbox="allow-same-origin allow-scripts allow-forms allow-popups"');
    });
  });

  describe('Private Chat Channel - Integration', () => {
    it('should create private chat info with iframe embed HTML', () => {
      const chatInfo = adapter.createPrivateChatInfo({
        sessionId: 'session-abc123',
        memberId: 'member-456',
        nickname: 'ChatUser'
      });

      expect(chatInfo.channelId).toContain('match-');
      expect(chatInfo.nickname).toBe('ChatUser');
      // Should use iframe embed to avoid 403 errors
      expect(chatInfo.embedHtml).toContain('<iframe');
      expect(chatInfo.embedHtml).toContain('sandbox="allow-same-origin allow-scripts allow-forms allow-popups"');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing generateEmbedHtml method for script-based embeds', () => {
      const channelId = 'forum-test';
      const nickname = 'User';

      const embedHtml = adapter['generateEmbedHtml'](channelId, nickname);

      // Original script-based embed should still work
      expect(embedHtml).toContain('data-channel="forum-test"');
      expect(embedHtml).toContain('embed.js');
    });
  });

  describe('Iframe Loading Timing - DOM getComputedStyle Error Fix', () => {
    it('should include onload event handler to prevent getComputedStyle errors', () => {
      const channelId = 'forum-test123';
      const nickname = 'TestUser';
      const embedHtml = adapter.generateIframeEmbed(channelId, nickname);

      // Should include an onload handler to ensure iframe is fully loaded before accessing
      expect(embedHtml).toContain('onload=');
    });

    it('should include loading state indicator to prevent premature DOM access', () => {
      const channelId = 'forum-test123';
      const nickname = 'TestUser';
      const embedHtml = adapter.generateIframeEmbed(channelId, nickname);

      // Should include loading attribute or visual indicator
      expect(embedHtml).toMatch(/loading=["']?lazy["']?|data-loading-state/);
    });

    it('should wrap iframe with container element for safer DOM manipulation', () => {
      const channelId = 'forum-test123';
      const nickname = 'TestUser';
      const embedHtml = adapter.generateIframeEmbed(channelId, nickname);

      // Should wrap iframe in a container div
      expect(embedHtml).toContain('<div');
      expect(embedHtml).toContain('</div>');
      expect(embedHtml).toContain('<iframe');
    });

    it('should include unique id attribute for reliable DOM querying', () => {
      const channelId = 'forum-test123';
      const nickname = 'TestUser';
      const embedHtml = adapter.generateIframeEmbed(channelId, nickname);

      // Should have an id based on channel to allow safe querying
      expect(embedHtml).toMatch(/id=["']tlk-iframe-forum-test123["']/);
    });

    it('should generate different unique ids for different channels', () => {
      const embedHtml1 = adapter.generateIframeEmbed('forum-abc', 'User1');
      const embedHtml2 = adapter.generateIframeEmbed('forum-xyz', 'User2');

      // Each iframe should have unique id
      expect(embedHtml1).toContain('id="tlk-iframe-forum-abc"');
      expect(embedHtml2).toContain('id="tlk-iframe-forum-xyz"');
      expect(embedHtml1).not.toEqual(embedHtml2);
    });
  });
});
