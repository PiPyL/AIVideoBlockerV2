/**
 * AI Video Blocker — Storage Utilities
 * Quản lý settings và cache qua chrome.storage.local
 */

const StorageManager = {
  /** Default settings cho extension */
  DEFAULT_SETTINGS: {
    enabled: true,
    sensitivity: 'medium', // 'low' | 'medium' | 'high'
    blockMode: 'blur',     // 'blur' | 'hide' | 'badge'
    detectionProfile: 'recall-first', // 'balanced' | 'recall-first'
    detectorVersion: 3,
    parentalPassword: '',
    isLocked: false,
    whitelistedChannels: [],
    blacklistedChannels: [],
    stats: {
      totalBlocked: 0,
      totalScanned: 0,
      lastActive: null,
      byContext: {
        home: { scanned: 0, blocked: 0 },
        search: { scanned: 0, blocked: 0 },
        watch: { scanned: 0, blocked: 0 },
        shorts: { scanned: 0, blocked: 0 },
        channel: { scanned: 0, blocked: 0 },
        other: { scanned: 0, blocked: 0 }
      },
      byMethod: {
        label: 0,
        keyword: 0,
        pattern: 0,
        channel: 0,
        combination: 0,
        disclosure: 0,
        none: 0
      },
      bySignal: {
        strong: 0,
        medium: 0,
        weak: 0
      }
    },
    // NLP keywords database
    aiKeywords: {
      high: [
        'ai generated', 'ai-generated', 'made with ai', 'created by ai',
        'tạo bởi ai', 'video ai', 'ai tạo',
        'sora', 'kling ai', 'runway gen', 'pika labs', 'haiper',
        'luma dream machine', 'minimax video', 'vidu ai',
        'synthesia', 'heygen', 'd-id', 'colossyan'
      ],
      medium: [
        'ai art', 'ai animation', 'ai video', 'ai movie',
        'deepfake', 'synthetic media', 'neural rendering',
        'text to video', 'image to video', 'ai music video',
        'ai cartoon', 'ai hoạt hình', 'ai phim',
        '#aiart', '#aivideo', '#aigeneratedcontent', '#aislop'
      ],
      low: [
        'artificial intelligence', 'machine learning', 'neural network',
        'generated', 'synthetic', 'automated', 'bot-created',
        'trí tuệ nhân tạo', 'học máy', '#ai'
      ]
    },
    // AI tool patterns in titles/descriptions
    aiToolPatterns: [
      /made\s*(with|using|by)\s*(sora|kling|runway|pika|luma|minimax|heygen|synthesia|d-id)/i,
      /\b(sora|kling|runway|pika)\s*(ai|video|gen)/i,
      /(ai|artificial.?intelligence)\s*(generated|created|made|produced)/i,
      /tạo\s*(bằng|bởi|từ)\s*(ai|trí tuệ nhân tạo)/i,
      /#(aigenerated|aiart|aivideo|aislop|aicontent)/i,
      /\b(kling|sora|veo|runway)\s*(1(\.5)?|2|3)?\b/i,
      /\b(prompt\s*to\s*video|text\s*to\s*video|image\s*to\s*video)\b/i,
      /\b(100%\s*ai|fully\s*ai|ai\s*only)\b/i
    ]
  },

  /**
   * Lấy settings hiện tại, merge với defaults
   */
  async getSettings() {
    try {
      const data = await chrome.storage.local.get('settings');
      const storedSettings = data.settings || {};
      const storedVersion = Number(storedSettings.detectorVersion || 0);
      const settings = { ...this.DEFAULT_SETTINGS, ...storedSettings };
      settings.aiToolPatterns = this.DEFAULT_SETTINGS.aiToolPatterns;
      if (storedVersion < this.DEFAULT_SETTINGS.detectorVersion) {
        settings.detectorVersion = this.DEFAULT_SETTINGS.detectorVersion;
        settings.aiKeywords = this.DEFAULT_SETTINGS.aiKeywords;
      }
      return settings;
    } catch (e) {
      console.warn('[AIBlocker] Storage read error:', e);
      return { ...this.DEFAULT_SETTINGS };
    }
  },

  /**
   * Cập nhật settings
   */
  async updateSettings(partial) {
    const current = await this.getSettings();
    const updated = { ...current, ...partial };
    const persistableSettings = { ...updated };
    delete persistableSettings.aiToolPatterns;
    await chrome.storage.local.set({ settings: persistableSettings });
    return updated;
  },

  /**
   * Lấy cache video đã scan
   */
  async getVideoCache() {
    try {
      const data = await chrome.storage.local.get('videoCache');
      return data.videoCache || {};
    } catch (e) {
      return {};
    }
  },

  /**
   * Cache kết quả scan video
   * @param {string} videoId
   * @param {object} result - { isAI, confidence, method, timestamp }
   */
  async cacheVideoResult(videoId, result) {
    const cache = await this.getVideoCache();
    cache[videoId] = {
      ...result,
      timestamp: Date.now()
    };

    // Giới hạn cache 5000 entries
    const entries = Object.entries(cache);
    if (entries.length > 5000) {
      const sorted = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const trimmed = Object.fromEntries(sorted.slice(-4000));
      await chrome.storage.local.set({ videoCache: trimmed });
    } else {
      await chrome.storage.local.set({ videoCache: cache });
    }
  },

  /**
   * Tăng counter thống kê
   */
  async incrementStat(key) {
    const settings = await this.getSettings();
    settings.stats[key] = (settings.stats[key] || 0) + 1;
    settings.stats.lastActive = Date.now();
    await this.updateSettings({ stats: settings.stats });
  },

  /**
   * Cập nhật thống kê theo batch để tránh ghi storage quá nhiều.
   * @param {object} payload
   */
  async updateDetectionStats(payload = {}) {
    const settings = await this.getSettings();
    const stats = settings.stats || {};
    const context = payload.context || 'other';
    const method = payload.method || 'none';
    const signalCounts = payload.signalCounts || {};

    stats.totalScanned = (stats.totalScanned || 0) + (payload.scanned || 0);
    stats.totalBlocked = (stats.totalBlocked || 0) + (payload.blocked || 0);
    stats.lastActive = Date.now();

    if (!stats.byContext) stats.byContext = {};
    if (!stats.byContext[context]) stats.byContext[context] = { scanned: 0, blocked: 0 };
    stats.byContext[context].scanned += payload.scanned || 0;
    stats.byContext[context].blocked += payload.blocked || 0;

    if (!stats.byMethod) stats.byMethod = {};
    stats.byMethod[method] = (stats.byMethod[method] || 0) + (payload.blocked || 0);

    if (!stats.bySignal) stats.bySignal = {};
    for (const level of ['strong', 'medium', 'weak']) {
      const value = Number(signalCounts[level] || 0);
      stats.bySignal[level] = (stats.bySignal[level] || 0) + value;
    }

    await this.updateSettings({ stats });
    return stats;
  },

  /**
   * Kiểm tra password phụ huynh
   */
  async verifyPassword(input) {
    const settings = await this.getSettings();
    if (!settings.parentalPassword) return true;
    return input === settings.parentalPassword;
  },

  /**
   * Xác định context trang YouTube hiện tại.
   */
  getYouTubeContext(pathname = '') {
    if (pathname === '/watch') return 'watch';
    if (pathname.startsWith('/results')) return 'search';
    if (pathname.startsWith('/shorts')) return 'shorts';
    if (pathname.startsWith('/@') || pathname.startsWith('/channel/') || pathname.startsWith('/c/')) return 'channel';
    if (pathname === '/' || pathname.startsWith('/feed/')) return 'home';
    return 'other';
  },

  /**
   * Kiểm tra channel có trong whitelist
   */
  async isWhitelisted(channelId) {
    const settings = await this.getSettings();
    return settings.whitelistedChannels.includes(channelId);
  }
};

// Export cho cả content script và service worker
if (typeof globalThis !== 'undefined') {
  globalThis.StorageManager = StorageManager;
}
