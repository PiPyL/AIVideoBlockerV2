/**
 * SafeKid — Platform Abstraction Layer
 * Detect platform (YouTube vs YouTube Kids) và cung cấp selectors/APIs tương ứng.
 *
 * Triết lý: Không hardcode quá nhiều YouTube Kids selectors vì chúng hay thay đổi.
 * Thay vào đó, cung cấp "known selectors" kết hợp với Runtime Discovery (ytk-discovery.js).
 */

const PlatformAdapter = {
  /** Cache platform detection result */
  _cachedPlatform: null,

  /** Detect platform dựa trên hostname */
  detect() {
    if (this._cachedPlatform) return this._cachedPlatform;
    const host = location.hostname;
    this._cachedPlatform = host.includes('youtubekids.com') ? 'youtube-kids' : 'youtube';
    return this._cachedPlatform;
  },

  /** Trả về config selectors cho platform hiện tại */
  getConfig() {
    return this.detect() === 'youtube-kids'
      ? this.YOUTUBE_KIDS_CONFIG
      : this.YOUTUBE_CONFIG;
  },

  /** Shorthand check */
  isYouTubeKids() {
    return this.detect() === 'youtube-kids';
  },

  /** Shorthand check */
  isYouTube() {
    return this.detect() === 'youtube';
  },

  /**
   * Merge discovered selectors vào config hiện tại.
   * Gọi từ YTKDiscovery sau khi discover xong.
   */
  mergeDiscoveredSelectors(discovered) {
    if (!discovered) return;
    const config = this.YOUTUBE_KIDS_CONFIG;

    if (discovered.videoCards?.length) {
      // Prepend discovered selectors (ưu tiên cao hơn)
      const existing = new Set(config.videoItemSelectors);
      for (const sel of discovered.videoCards) {
        if (!existing.has(sel)) {
          config.videoItemSelectors.unshift(sel);
          existing.add(sel);
        }
      }
    }

    if (discovered.titles?.length) {
      config.titleSelectors = [...new Set([...discovered.titles, ...config.titleSelectors])];
    }

    if (discovered.channels?.length) {
      config.channelSelectors = [...new Set([...discovered.channels, ...config.channelSelectors])];
    }

    if (discovered.thumbnails?.length) {
      config.thumbnailSelectors = [...new Set([...discovered.thumbnails, ...config.thumbnailSelectors])];
    }

    if (discovered.player) {
      config.playerSelector = discovered.player + ', ' + config.playerSelector;
    }

    config._discoveredAt = discovered.discoveredAt || Date.now();
  },

  // ==================== YOUTUBE CONFIG ====================

  YOUTUBE_CONFIG: {
    platform: 'youtube',

    /** App shell element */
    appShell: 'ytd-app',

    /** Video item container selectors — dùng để tìm video cards trên feed/search */
    videoItemSelectors: [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-reel-item-renderer',
      'ytm-shorts-lockup-view-model',
      'yt-lockup-view-model'
    ],

    /** Title selectors — dùng bên trong video item để tìm title text */
    titleSelectors: [
      '#video-title',
      'a#video-title',
      'h3 a#video-title',
      'yt-formatted-string#video-title',
      '.title',
      'span#video-title'
    ],

    /** Channel selectors — dùng bên trong video item để tìm channel name */
    channelSelectors: [
      'ytd-channel-name',
      '#channel-name',
      '.ytd-channel-name',
      'a.yt-simple-endpoint[href*="/@"]',
      'a.yt-simple-endpoint[href*="/channel/"]'
    ],

    /** Player selectors — dùng trên watch page */
    playerSelector: '#movie_player, #player-container-inner, #player',

    /** Thumbnail selectors — dùng trong video item */
    thumbnailSelectors: [
      'ytd-thumbnail',
      'yt-thumbnail-view-model',
      'a#thumbnail',
      '#thumbnail'
    ],

    /** Link selectors — tìm href chứa videoId */
    linkSelectors: [
      'a#video-title-link',
      'a#video-title',
      'a[href*="watch?v="]',
      'a#thumbnail[href*="watch?v="]',
      'a[href*="/shorts/"]'
    ],

    /** Navigation events của YouTube SPA */
    navigationEvents: ['yt-navigate-start', 'yt-navigate-finish', 'yt-page-data-updated'],

    /** URL patterns */
    watchPagePath: '/watch',
    shortsPagePath: '/shorts/',

    /** YouTube chính không cần deep shadow traversal cho phần lớn content */
    requiresShadowTraversal: false,

    /**
     * Extract videoId từ element.
     * @param {Element} element - Video item element
     * @returns {string|null}
     */
    extractVideoId(element) {
      // Tìm trong href attributes
      const links = element.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';

        // /watch?v=VIDEO_ID
        const watchMatch = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (watchMatch) return watchMatch[1];

        // /shorts/VIDEO_ID
        const shortsMatch = href.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
        if (shortsMatch) return shortsMatch[1];
      }

      // Fallback: data attributes
      const dataId = element.getAttribute('data-video-id') ||
                     element.querySelector('[data-video-id]')?.getAttribute('data-video-id');
      if (dataId) return dataId;

      return null;
    },

    /**
     * Extract title text từ video item.
     * @param {Element} element - Video item element
     * @returns {string}
     */
    extractTitle(element) {
      for (const sel of this.titleSelectors) {
        const titleEl = element.querySelector(sel);
        if (titleEl) {
          const text = (titleEl.getAttribute('title') || titleEl.textContent || '').trim();
          if (text) return text;
        }
      }
      return '';
    },

    /**
     * Extract channel name từ video item.
     * @param {Element} element - Video item element
     * @returns {string}
     */
    extractChannel(element) {
      for (const sel of this.channelSelectors) {
        const channelEl = element.querySelector(sel);
        if (channelEl) {
          const text = (channelEl.textContent || '').trim();
          if (text) return text;
        }
      }
      return '';
    },

    /**
     * Kiểm tra element có phải video card/item không.
     * @param {Element} el
     * @returns {boolean}
     */
    isVideoItem(el) {
      const tag = (el.tagName || '').toLowerCase();
      return this.videoItemSelectors.some(sel => {
        // Tag name match
        if (!sel.startsWith('.') && !sel.startsWith('#') && !sel.startsWith('[')) {
          return tag === sel.toLowerCase();
        }
        return el.matches(sel);
      });
    }
  },

  // ==================== YOUTUBE KIDS CONFIG ====================

  YOUTUBE_KIDS_CONFIG: {
    platform: 'youtube-kids',

    /** App shell — cần runtime discover để confirm */
    appShell: 'ytk-app, #app, [id*="app"]',

    /** Video item selectors — sẽ được bổ sung bởi Runtime Discovery */
    videoItemSelectors: [
      'ytk-compact-video-renderer',
      'ytk-video-card-renderer',
      'ytk-browse-item-renderer',
      'ytk-item-card-renderer',
      // Fallback generic selectors
      '[class*="video-card"]',
      '[class*="compact-video"]',
      '[class*="browse-item"]',
      '[data-video-id]'
    ],

    /** Title selectors */
    titleSelectors: [
      '.video-title',
      '.title',
      '[class*="title"]',
      'h3',
      'span[class*="title"]',
      'a[class*="title"]'
    ],

    /** Channel selectors */
    channelSelectors: [
      '.channel-name',
      '[class*="channel"]',
      '[class*="creator"]',
      '[class*="author"]',
      '[class*="byline"]'
    ],

    /** Player selectors */
    playerSelector: '#player, #movie_player, video, [class*="player-container"], [class*="video-player"]',

    /** Thumbnail selectors */
    thumbnailSelectors: [
      'img[class*="thumbnail"]',
      '.thumbnail img',
      '.thumbnail',
      'img[src*="ytimg"]',
      'img[src*="i.ytimg.com"]',
      'img'
    ],

    /** Link selectors — YouTube Kids có thể dùng structure khác */
    linkSelectors: [
      'a[href*="watch"]',
      'a[href*="video"]',
      'a[data-video-id]',
      '[data-video-id]',
      'a[href]'
    ],

    /** Navigation events — YouTube Kids có thể dùng custom events hoặc standard browser events */
    navigationEvents: [
      'yt-navigate-finish',
      'popstate',
      'hashchange'
    ],

    /** URL patterns — YouTube Kids có URL structure khác */
    watchPagePath: null, // Sẽ được discover
    shortsPagePath: null, // YouTube Kids không có Shorts

    /** YouTube Kids cần deep shadow traversal */
    requiresShadowTraversal: true,

    /** Internal — set by discovery */
    _discoveredAt: null,

    /**
     * Extract videoId từ element.
     * YouTube Kids có thể nhúng videoId trong data-attributes hoặc href khác.
     */
    extractVideoId(element) {
      // 1. Data attribute trực tiếp
      const dataId = element.getAttribute('data-video-id') ||
                     element.getAttribute('data-id') ||
                     element.dataset?.videoId;
      if (dataId) return dataId;

      // 2. Tìm trong child elements (bao gồm shadow DOM)
      const childWithId = element.querySelector('[data-video-id]') ||
                          element.querySelector('[data-id]');
      if (childWithId) {
        return childWithId.getAttribute('data-video-id') || childWithId.getAttribute('data-id');
      }

      // 3. Tìm trong href
      const links = element.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';

        const watchMatch = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (watchMatch) return watchMatch[1];

        const shortsMatch = href.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
        if (shortsMatch) return shortsMatch[1];

        // YouTube Kids có thể encode videoId trong path khác
        const idMatch = href.match(/\/([a-zA-Z0-9_-]{11})(?:\?|$|\/)/);
        if (idMatch) return idMatch[1];
      }

      // 4. Shadow DOM traversal
      if (typeof ShadowDomHelper !== 'undefined') {
        const shadowLink = ShadowDomHelper.deepQuery('a[href*="watch"], a[data-video-id]', element);
        if (shadowLink) {
          const href = shadowLink.getAttribute('href') || '';
          const match = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
          if (match) return match[1];
          return shadowLink.getAttribute('data-video-id');
        }
      }

      return null;
    },

    /**
     * Extract title text — YouTube Kids dùng shadow DOM nên cần deep query.
     */
    extractTitle(element) {
      // Thử selectors thông thường trước
      for (const sel of this.titleSelectors) {
        const titleEl = element.querySelector(sel);
        if (titleEl) {
          const text = (titleEl.getAttribute('title') || titleEl.getAttribute('aria-label') || titleEl.textContent || '').trim();
          if (text && text.length > 2) return text;
        }
      }

      // Fallback: shadow DOM traversal
      if (typeof ShadowDomHelper !== 'undefined') {
        for (const sel of this.titleSelectors) {
          const titleEl = ShadowDomHelper.deepQuery(sel, element);
          if (titleEl) {
            const text = (titleEl.getAttribute('title') || titleEl.textContent || '').trim();
            if (text && text.length > 2) return text;
          }
        }
      }

      // Last resort: tìm text node lớn nhất (không phải trong img/script)
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        { acceptNode: (node) => node.textContent.trim().length > 5 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP }
      );
      let longestText = '';
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        if (text.length > longestText.length && text.length < 200) {
          longestText = text;
        }
      }
      return longestText;
    },

    /**
     * Extract channel name — YouTube Kids.
     */
    extractChannel(element) {
      for (const sel of this.channelSelectors) {
        const channelEl = element.querySelector(sel);
        if (channelEl) {
          const text = (channelEl.textContent || '').trim();
          if (text && text.length > 1) return text;
        }
      }

      // Shadow DOM fallback
      if (typeof ShadowDomHelper !== 'undefined') {
        for (const sel of this.channelSelectors) {
          const channelEl = ShadowDomHelper.deepQuery(sel, element);
          if (channelEl) {
            const text = (channelEl.textContent || '').trim();
            if (text && text.length > 1) return text;
          }
        }
      }

      return '';
    },

    /**
     * Kiểm tra element có phải video card/item.
     */
    isVideoItem(el) {
      const tag = (el.tagName || '').toLowerCase();

      // Check tag name match
      if (tag.startsWith('ytk-') && (tag.includes('video') || tag.includes('item') || tag.includes('card'))) {
        return true;
      }

      // Check selector match
      return this.videoItemSelectors.some(sel => {
        try {
          return el.matches(sel);
        } catch {
          return false;
        }
      });
    }
  }
};

// Export cho content scripts
if (typeof globalThis !== 'undefined') {
  globalThis.PlatformAdapter = PlatformAdapter;
}
