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
    // Format: forum-{forumId} (truncated to avoid tlk.io limits)
    const channelId = `forum-${forumId}`.substring(0, 50);
    return this.sanitizeChannelId(channelId);
  }

  generatePrivateChatChannelId(sessionId: string): string {
    // Generate deterministic channel ID for private chat
    // Format: match-{sessionId} (truncated to avoid tlk.io limits)
    const channelId = `match-${sessionId}`.substring(0, 50);
    return this.sanitizeChannelId(channelId);
  }

  createForumChatInfo(request: ForumChatRequest): ChatChannelInfo {
    const channelId = this.generateForumChannelId(request.forumId);
    const embedHtml = this.generateEmbedHtml(channelId, request.nickname);

    return {
      channelId,
      embedHtml,
      nickname: request.nickname
    };
  }

  createPrivateChatInfo(request: PrivateChatRequest): ChatChannelInfo {
    const channelId = this.generatePrivateChatChannelId(request.sessionId);
    const embedHtml = this.generateEmbedHtml(channelId, request.nickname);

    return {
      channelId,
      embedHtml,
      nickname: request.nickname
    };
  }

  private generateEmbedHtml(channelId: string, nickname: string): string {
    // Sanitize inputs to prevent XSS
    const safeChannelId = this.escapeHtml(channelId);
    const safeNickname = this.escapeHtml(nickname);
    const safeTheme = this.escapeHtml(this.theme);

    // Generate tlk.io embed HTML
    return `
<div id="tlkio" data-channel="${safeChannelId}" data-theme="${safeTheme}" data-nickname="${safeNickname}" style="width:100%;height:400px;"></div>
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
