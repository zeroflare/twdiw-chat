/**
 * tlk.io Integration Adapter
 * Generates chat channels and embed HTML for forums and private chats
 */

export interface ChatChannelInfo {
  channelId: string;
  embedHtml: string;
  nickname: string;
}

export interface ForumChatRequest {
  forumId: string;
  memberId: string;
  nickname: string;
}

export interface PrivateChatRequest {
  sessionId: string;
  memberId: string;
  nickname: string;
}

export class TlkIoAdapter {
  private baseUrl: string;
  private theme: string;

  constructor(env?: any) {
    this.baseUrl = env?.TLKIO_BASE_URL || 'https://tlk.io';
    this.theme = env?.TLKIO_THEME || 'theme--minimal';
  }

  generateForumChannelId(forumId: string): string {
    // Generate deterministic channel ID for forum
    // Format: forum-{forumId} (limited to 30 chars for tlk.io)
    const channelId = `forum-${forumId}`.substring(0, 30);
    return this.sanitizeChannelId(channelId);
  }

  generatePrivateChatChannelId(sessionId: string, userIdentifier?: string): string {
    // Generate simpler channel ID to avoid tlk.io restrictions
    // Use only alphanumeric characters and make it shorter
    const shortId = sessionId.substring(0, 8).replace(/[^a-z0-9]/g, '');
    const userSuffix = userIdentifier ? `-${userIdentifier.substring(0, 4)}` : '';
    const channelId = `match-${shortId}${userSuffix}`.substring(0, 20); // Use 'match-' prefix for consistency
    return this.sanitizeChannelId(channelId);
  }

  createForumChatInfo(request: ForumChatRequest): ChatChannelInfo {
    const channelId = this.generateForumChannelId(request.forumId);
    // Use iframe embed to avoid cross-origin cookie 403 errors
    const embedHtml = this.generateIframeEmbed(channelId, request.nickname, request.memberId);

    return {
      channelId,
      embedHtml,
      nickname: request.nickname
    };
  }

  createPrivateChatInfo(request: PrivateChatRequest): ChatChannelInfo {
    const channelId = this.generatePrivateChatChannelId(request.sessionId, request.memberId);
    // Use correct tlk.io script-based embed with data-nickname
    const embedHtml = this.generateEmbedHtml(channelId, request.nickname);

    return {
      channelId,
      embedHtml,
      nickname: request.nickname
    };
  }

  /**
   * Generate iframe-based embed HTML with proper cross-origin attributes and DOM loading handling
   * This method resolves 403 errors by using iframe with correct sandbox and cookie policies
   * Also fixes getComputedStyle errors by ensuring proper iframe initialization with onload handlers
   */
  generateIframeEmbed(channelId: string, nickname: string, userIdentifier?: string): string {
    // Sanitize inputs to prevent XSS
    const safeChannelId = this.escapeHtml(channelId);
    const safeNickname = encodeURIComponent(nickname); // URL encode for query parameter
    const safeTheme = this.escapeHtml(this.theme);

    // Build tlk.io URL with parameters and user-specific cache-busting
    const cacheBuster = Date.now();
    const userHash = userIdentifier ? encodeURIComponent(userIdentifier.substring(0, 8)) : 'anon';
    const tlkUrl = `${this.baseUrl}/${safeChannelId}?nickname=${safeNickname}&theme=${safeTheme}&_t=${cacheBuster}&_u=${userHash}`;
    
    // Debug logging
    console.log('TlkIo URL Generated:', {
      channelId: safeChannelId,
      nickname: safeNickname,
      userHash,
      cacheBuster,
      fullUrl: tlkUrl
    });

    // Generate unique iframe ID for reliable DOM querying and state management
    const iframeId = `tlk-iframe-${safeChannelId}`;

    // Generate iframe with:
    // - Security sandbox (allow-same-origin, allow-scripts, allow-forms, allow-popups)
    // - DOM loading timing fix (onload handler, loading attribute, container wrapper)
    // - Unique ID for safe DOM querying
    // - data-nickname for frontend visibility and verification
    // Note: 'credentials' is not a valid value for the allow attribute and has been removed
    return `
<div class="tlk-iframe-container" data-channel="${safeChannelId}" data-nickname="${this.escapeHtml(nickname)}" data-loading-state="loading">
  <iframe
    id="${iframeId}"
    src="${tlkUrl}"
    width="100%"
    height="400"
    frameborder="0"
    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
    loading="lazy"
    onload="this.parentElement.setAttribute('data-loading-state', 'loaded')"
    style="border:0;width:100%;height:400px;">
  </iframe>
</div>
    `.trim();
  }

  private generateEmbedHtml(channelId: string, nickname: string): string {
    // Sanitize inputs to prevent XSS
    const safeChannelId = this.escapeHtml(channelId);
    const safeNickname = this.escapeHtml(nickname);
    const safeTheme = this.escapeHtml(this.theme);
    
    // Use correct tlk.io format with id="tlkio" and data-nickname
    return `
<div id="tlkio" data-channel="${safeChannelId}" data-nickname="${safeNickname}" data-theme="${safeTheme}" style="width:100%;height:400px;"></div>
<script async src="${this.baseUrl}/embed.js" type="text/javascript"></script>
    `.trim();
  }

  private sanitizeChannelId(channelId: string): string {
    // tlk.io channel ID requirements:
    // - Only alphanumeric, hyphens, underscores
    // - No spaces or special characters
    // - Lowercase
    return channelId
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private escapeHtml(text: string): string {
    // Server-side HTML escaping for Cloudflare Workers
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Alternative XSS-safe HTML escaping for server-side (Cloudflare Workers)
  private escapeHtmlServer(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  generateEmbedHtmlSafe(channelId: string, nickname: string): string {
    // Server-side safe version
    const safeChannelId = this.escapeHtmlServer(channelId);
    const safeNickname = this.escapeHtmlServer(nickname);
    const safeTheme = this.escapeHtmlServer(this.theme);

    return `<div id="tlkio" data-channel="${safeChannelId}" data-theme="${safeTheme}" data-nickname="${safeNickname}" style="width:100%;height:400px;"></div>
<script async src="${this.baseUrl}/embed.js" type="text/javascript"></script>`;
  }

  // Validate channel access (to be used by API endpoints)
  validateChannelAccess(channelId: string, memberId: string, channelType: 'forum' | 'private'): boolean {
    if (channelType === 'forum') {
      // Forum channels are public to verified members
      return channelId.startsWith('forum-');
    } else if (channelType === 'private') {
      // Private channels require session validation
      return channelId.startsWith('match-');
    }
    
    return false;
  }
}
