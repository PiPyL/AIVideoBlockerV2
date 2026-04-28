/**
 * SafeKid — YouTube Kids Runtime Discovery
 * Tự động tìm và map DOM structure của YouTube Kids.
 *
 * Vì YouTube Kids dùng obfuscated class names và Shadow DOM,
 * module này sẽ:
 * 1. Scan DOM tree (bao gồm shadow roots) để tìm video cards
 * 2. Heuristic-detect dựa trên cấu trúc (có img + title + link = video card)
 * 3. Cache discovered selectors
 * 4. Fallback nếu discovery fail
 */

const YTKDiscovery = {
  LOG_PREFIX: '[SafeKid:YTK-Discovery]',

  /** Cache thời gian discovery hợp lệ (24h) */
  CACHE_TTL_MS: 24 * 60 * 60 * 1000,

  /** Trạng thái discovery */
  _discoveredSelectors: null,
  _isDiscovering: false,

  /**
   * Khởi động discovery. Gọi sau khi YouTube Kids page load xong.
   * @returns {object} discovered selectors
   */
  async discover() {
    if (this._isDiscovering) return this._discoveredSelectors;
    this._isDiscovering = true;

    try {
      // 1. Check cache trước
      const cached = await this._loadCachedSelectors();
      if (cached) {
        console.log(`${this.LOG_PREFIX} Using cached selectors (discovered ${new Date(cached.discoveredAt).toLocaleString()})`);
        this._discoveredSelectors = cached;
        PlatformAdapter.mergeDiscoveredSelectors(cached);
        return cached;
      }

      // 2. Đợi DOM sẵn sàng
      await this._waitForContent();

      // 3. Run discovery
      console.log(`${this.LOG_PREFIX} Starting runtime discovery...`);
      const selectors = await this._runDiscovery();

      // 4. Cache kết quả
      if (selectors.videoCards.length > 0) {
        await this._cacheSelectors(selectors);
        console.log(`${this.LOG_PREFIX} Discovery complete:`, selectors);
      } else {
        console.warn(`${this.LOG_PREFIX} Discovery found no video cards — using fallback selectors`);
      }

      this._discoveredSelectors = selectors;
      PlatformAdapter.mergeDiscoveredSelectors(selectors);
      return selectors;
    } catch (e) {
      console.error(`${this.LOG_PREFIX} Discovery failed:`, e);
      return this._getFallbackSelectors();
    } finally {
      this._isDiscovering = false;
    }
  },

  /**
   * Force re-discover (bỏ qua cache).
   */
  async rediscover() {
    await chrome.storage.local.remove('ytkSelectors');
    this._discoveredSelectors = null;
    return this.discover();
  },

  /**
   * Lấy discovered selectors (hoặc fallback).
   */
  getSelectors() {
    return this._discoveredSelectors || this._getFallbackSelectors();
  },

  // ==================== INTERNAL ====================

  /**
   * Đợi cho YouTube Kids render xong content chính.
   */
  async _waitForContent() {
    const MAX_WAIT = 10000; // 10s
    const POLL_INTERVAL = 500;
    const start = Date.now();

    return new Promise((resolve) => {
      const check = () => {
        // Tìm dấu hiệu content đã render:
        // - Có ít nhất 1 img element (thumbnails)
        // - Hoặc có ytk-* custom elements
        const hasImages = document.querySelectorAll('img[src*="ytimg"], img[src*="thumbnail"]').length > 0;
        const hasYtkElements = document.querySelectorAll('[class*="ytk-"], [class*="video"]').length > 0;
        const hasAnyContent = document.querySelectorAll('a[href]').length > 5;

        if (hasImages || hasYtkElements || hasAnyContent || Date.now() - start > MAX_WAIT) {
          resolve();
          return;
        }
        setTimeout(check, POLL_INTERVAL);
      };
      check();
    });
  },

  /**
   * Main discovery logic.
   */
  async _runDiscovery() {
    const result = {
      videoCards: [],
      titles: [],
      channels: [],
      thumbnails: [],
      player: null,
      appShell: null,
      navigationMethod: 'popstate', // default
      discovered: true,
      discoveredAt: Date.now()
    };

    // === Step 1: Tìm custom elements với prefix ytk- ===
    const ytkTags = this._findCustomElementTags('ytk-');
    if (ytkTags.length > 0) {
      console.log(`${this.LOG_PREFIX} Found ytk- elements:`, ytkTags);

      // Phân loại
      for (const tag of ytkTags) {
        if (tag.includes('video') || tag.includes('item') || tag.includes('card') || tag.includes('compact')) {
          result.videoCards.push(tag);
        }
        if (tag.includes('app') || tag.includes('shell')) {
          result.appShell = tag;
        }
        if (tag.includes('player')) {
          result.player = tag;
        }
      }
    }

    // === Step 2: Heuristic discovery — tìm video cards bằng structure pattern ===
    if (result.videoCards.length === 0) {
      const heuristicCards = this._discoverByHeuristic();
      if (heuristicCards.length > 0) {
        result.videoCards = heuristicCards;
      }
    }

    // === Step 3: Discover title/channel selectors trong video cards ===
    if (result.videoCards.length > 0) {
      const firstSelector = result.videoCards[0];
      const sampleCards = document.querySelectorAll(firstSelector);
      if (sampleCards.length > 0) {
        const internalSelectors = this._discoverInternalSelectors(sampleCards[0]);
        if (internalSelectors.title) result.titles.push(internalSelectors.title);
        if (internalSelectors.channel) result.channels.push(internalSelectors.channel);
        if (internalSelectors.thumbnail) result.thumbnails.push(internalSelectors.thumbnail);
      }
    }

    // === Step 4: Discover navigation method ===
    result.navigationMethod = this._discoverNavigationMethod();

    return result;
  },

  /**
   * Tìm tất cả custom element tag names với prefix cụ thể.
   * @param {string} prefix
   * @returns {string[]}
   */
  _findCustomElementTags(prefix) {
    const tags = new Set();

    // Scan document
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const tag = el.tagName.toLowerCase();
      if (tag.startsWith(prefix)) {
        tags.add(tag);
      }
    }

    // Scan shadow DOM
    if (typeof ShadowDomHelper !== 'undefined') {
      const shadowElements = ShadowDomHelper.deepQueryAll('*');
      for (const el of shadowElements) {
        const tag = el.tagName.toLowerCase();
        if (tag.startsWith(prefix)) {
          tags.add(tag);
        }
      }
    }

    return Array.from(tags);
  },

  /**
   * Heuristic discovery: tìm video cards dựa trên cấu trúc DOM.
   * Video card = element chứa: thumbnail (img) + title (text) + link (a[href])
   * Các video cards thường cùng level, nằm trong grid container.
   */
  _discoverByHeuristic() {
    const allElements = document.querySelectorAll('*');
    const candidateMap = new Map(); // tagName -> count

    for (const el of allElements) {
      // Skip elements quá nhỏ hoặc quá lớn
      const rect = el.getBoundingClientRect?.();
      if (rect && (rect.width < 50 || rect.height < 50 || rect.width > 800 || rect.height > 600)) {
        continue;
      }

      const hasImg = el.querySelector('img') !== null;
      const hasLink = el.querySelector('a[href]') !== null;
      const textLen = (el.textContent || '').trim().length;
      const hasReasonableText = textLen > 3 && textLen < 500;

      if (hasImg && hasLink && hasReasonableText) {
        const tag = el.tagName.toLowerCase();
        const className = el.className || '';
        const key = tag.includes('-')
          ? tag // Custom element — dùng tag name
          : (className ? `.${className.split(' ')[0]}` : tag); // Dùng class

        candidateMap.set(key, (candidateMap.get(key) || 0) + 1);
      }
    }

    // Chọn selector xuất hiện nhiều nhất (>= 3 items = likely grid)
    const sorted = Array.from(candidateMap.entries())
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1]);

    return sorted.slice(0, 3).map(([sel]) => sel);
  },

  /**
   * Discover internal selectors (title, channel, thumbnail) bên trong 1 video card.
   */
  _discoverInternalSelectors(card) {
    const result = { title: null, channel: null, thumbnail: null };

    // Title: tìm text node lớn nhất (không phải trong channel/metadata area)
    const textElements = card.querySelectorAll('h1, h2, h3, h4, span, a, div, p');
    let bestTitle = null;
    let bestTitleLen = 0;

    for (const el of textElements) {
      const text = (el.textContent || '').trim();
      // Title thường 10-120 chars, là direct text (không chứa quá nhiều child text)
      if (text.length > 5 && text.length < 150 && text.length > bestTitleLen) {
        const directText = Array.from(el.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent.trim())
          .join('');

        if (directText.length > 3) {
          bestTitle = this._buildSelector(el, card);
          bestTitleLen = text.length;
        }
      }
    }
    result.title = bestTitle;

    // Thumbnail: tìm img element chính
    const imgs = card.querySelectorAll('img');
    for (const img of imgs) {
      const src = img.src || img.getAttribute('src') || '';
      if (src.includes('ytimg') || src.includes('thumbnail') || src.includes('i.ytimg.com') || src.includes('i9.ytimg.com')) {
        result.thumbnail = this._buildSelector(img, card);
        break;
      }
    }
    if (!result.thumbnail && imgs.length > 0) {
      result.thumbnail = 'img';
    }

    return result;
  },

  /**
   * Build CSS selector cho element relative to parent.
   */
  _buildSelector(el, parent) {
    // Ưu tiên: id > tag.class > tag
    if (el.id) return `#${el.id}`;

    const tag = el.tagName.toLowerCase();

    // Custom element
    if (tag.includes('-')) return tag;

    // Class name (chọn class đầu tiên không phải obfuscated)
    const classes = Array.from(el.classList || [])
      .filter(c => c.length > 2 && !c.match(/^[a-z]{1,2}$/)); // Skip single-letter classes

    if (classes.length > 0) {
      return `${tag}.${classes[0]}`;
    }

    return tag;
  },

  /**
   * Discover navigation method (SPA vs MPA).
   */
  _discoverNavigationMethod() {
    // Check nếu có YouTube SPA events
    const hasYtNavEvents = typeof window.__yt_navigation !== 'undefined' ||
                           document.querySelector('ytk-app, ytd-app') !== null;

    if (hasYtNavEvents) return 'yt-events';

    // Check nếu dùng hash routing
    if (location.hash.length > 1) return 'hash';

    // Default: History API
    return 'popstate';
  },

  // ==================== CACHE ====================

  async _loadCachedSelectors() {
    try {
      const data = await chrome.storage.local.get('ytkSelectors');
      const cached = data.ytkSelectors;
      if (!cached?.discovered) return null;
      if (!cached.discoveredAt) return null;

      // Check TTL
      if (Date.now() - cached.discoveredAt > this.CACHE_TTL_MS) {
        console.log(`${this.LOG_PREFIX} Cached selectors expired`);
        return null;
      }

      // Validate: ít nhất phải có videoCards
      if (!cached.videoCards?.length) return null;

      return cached;
    } catch {
      return null;
    }
  },

  async _cacheSelectors(selectors) {
    try {
      await chrome.storage.local.set({ ytkSelectors: selectors });
    } catch (e) {
      console.warn(`${this.LOG_PREFIX} Failed to cache selectors:`, e);
    }
  },

  // ==================== FALLBACK ====================

  _getFallbackSelectors() {
    return {
      videoCards: [
        'ytk-compact-video-renderer',
        'ytk-video-card-renderer',
        'ytk-browse-item-renderer',
        'ytk-item-card-renderer',
        '[class*="video-card"]',
        '[data-video-id]'
      ],
      titles: ['.video-title', '.title', '[class*="title"]', 'h3'],
      channels: ['.channel-name', '[class*="channel"]', '[class*="byline"]'],
      thumbnails: ['img[src*="ytimg"]', '.thumbnail', 'img'],
      player: '#player, video',
      appShell: 'ytk-app, #app',
      navigationMethod: 'popstate',
      discovered: false,
      discoveredAt: null
    };
  }
};

// Export cho content scripts
if (typeof globalThis !== 'undefined') {
  globalThis.YTKDiscovery = YTKDiscovery;
}
