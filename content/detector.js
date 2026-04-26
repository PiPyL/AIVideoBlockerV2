/**
 * AI Video Blocker — Detector Module
 * Tầng 1: YouTube Labels Detection
 * Tầng 2: NLP Heuristics (keyword matching, pattern analysis)
 */

const AIDetector = {
  DETECTOR_VERSION: 4,

  /**
   * Kết quả phát hiện
   * @typedef {Object} DetectionResult
   * @property {boolean} isAI
   * @property {number} confidence - 0 to 1
   * @property {string} method - 'label' | 'keyword' | 'pattern' | 'channel'
   * @property {string[]} reasons
   */

  /**
   * Phân tích một video element trên feed/search
   * @param {HTMLElement} videoElement - ytd-rich-item-renderer hoặc ytd-video-renderer
   * @returns {DetectionResult}
   */
  analyzeVideoElement(videoElement, settings) {
    if (!videoElement || !settings?.enabled) return this._emptyResult();

    const videoInfo = this._extractVideoInfo(videoElement);
    if (!videoInfo.title && !videoInfo.description) return this._emptyResult();

    const normalizedInfo = this._normalizeVideoInfo(videoInfo);
    const signals = this._detectSignals(videoElement, normalizedInfo, settings, 'feed');
    return this._scoreSignals(signals, settings, normalizedInfo);
  },

  /**
   * Phân tích video page (khi đang xem video)
   */
  analyzeVideoPage(settings) {
    if (!settings?.enabled) return this._emptyResult();

    const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.ytd-video-primary-info-renderer');
    const channelEl = document.querySelector('#owner #channel-name a, ytd-channel-name a');
    const descEl = document.querySelector('#description-inner, ytd-text-inline-expander, #structured-description');
    const watchInfo = {
      title: (titleEl?.textContent || '').trim(),
      channel: (channelEl?.textContent || '').trim(),
      description: (descEl?.textContent || '').trim(),
      channelUrl: channelEl?.href || '',
      videoId: this._extractWatchVideoId(location.href),
      badges: []
    };
    const normalizedInfo = this._normalizeVideoInfo(watchInfo);
    const watchMetadataRoot = document.querySelector('ytd-watch-metadata, #above-the-fold, ytd-video-primary-info-renderer') ||
      descEl ||
      document.createElement('div');
    const signals = this._detectSignals(watchMetadataRoot, normalizedInfo, settings, 'watch');

    const pageDataResult = this._checkPageData(watchInfo.videoId);
    if (pageDataResult.score > 0) {
      signals.push({
        type: 'pageData',
        strength: 'strong',
        weight: 0.9,
        reason: pageDataResult.reasons.join(' • '),
        method: 'disclosure'
      });
    }

    const descResult = this._checkDescription();
    if (descResult.score > 0) {
      signals.push({
        type: 'watchDescription',
        strength: 'strong',
        weight: 0.75,
        reason: descResult.reasons.join(' • '),
        method: 'disclosure'
      });
    }

    return this._scoreSignals(signals, settings, normalizedInfo);
  },

  analyzeShortsPage(settings) {
    if (!settings?.enabled) return this._emptyResult();

    const activeShort = document.querySelector('ytd-reel-video-renderer[is-active], ytd-reel-video-renderer');
    const shortsRoot = activeShort?.closest('ytd-shorts, #shorts-container') ||
      document.querySelector('ytd-shorts, #shorts-container') ||
      activeShort ||
      document.body;
    const titleEl = activeShort?.querySelector('#shorts-title, h2, #video-title, yt-formatted-string') ||
      shortsRoot.querySelector('h2#shorts-video-title, #shorts-title, ytd-reel-player-header-renderer h2, ytd-reel-player-overlay-renderer h2, #description h2') ||
      document.querySelector('h2#shorts-video-title, #shorts-title, ytd-reel-player-header-renderer h2, ytd-reel-player-overlay-renderer h2');
    const channelEl = activeShort?.querySelector('ytd-channel-name a, #channel-name a, a[href^="/@"]') ||
      shortsRoot.querySelector('ytd-reel-player-header-renderer ytd-channel-name a, ytd-reel-player-header-renderer a[href^="/@"], ytd-reel-player-overlay-renderer a[href^="/@"]') ||
      document.querySelector('ytd-reel-player-header-renderer ytd-channel-name a, ytd-reel-player-header-renderer a[href^="/@"]');
    const descEl = activeShort?.querySelector('#description, #description-text') ||
      shortsRoot.querySelector('ytd-reel-player-overlay-renderer #description, #description') ||
      document.querySelector('ytd-reel-player-overlay-renderer #description, #description');

    const shortsSignalsText = this._extractShortsSignalsText(shortsRoot);
    const titleFallback = this._getShortsTitleFallback();
    const channelFallback = this._getShortsChannelFallback();
    const shortsInfo = {
      title: ((titleEl?.textContent || '').trim() || titleFallback),
      channel: ((channelEl?.textContent || '').trim() || channelFallback),
      description: `${(descEl?.textContent || '').trim()} ${shortsSignalsText}`.trim(),
      channelUrl: channelEl?.href || '',
      videoId: this._extractShortsVideoId(location.href),
      badges: []
    };
    const normalizedInfo = this._normalizeVideoInfo(shortsInfo);
    const signals = this._detectSignals(shortsRoot, normalizedInfo, settings, 'watch');
    const shortTagSignal = this._checkShortsHashtags(normalizedInfo);
    if (shortTagSignal) signals.push(shortTagSignal);
    return this._scoreSignals(signals, settings, normalizedInfo);
  },

  // ==================== PRIVATE METHODS ====================

  /**
   * Trích xuất thông tin từ video element
   */
  _extractVideoInfo(el) {
    const titleEl = this._queryFirst(el, [
      '#video-title',
      'a#video-title',
      'a#video-title-link',
      'h3 a',
      'h3',
      '.ytLockupMetadataViewModelTitle',
      'a.ytLockupMetadataViewModelTitle',
      '.shortsLockupViewModelHostMetadataTitle',
      'a.shortsLockupViewModelHostOutsideMetadataEndpoint',
      '#shorts-title',
      'h2'
    ]);
    const channelEl = this._queryFirst(el, [
      '#channel-name a',
      'ytd-channel-name a',
      '.ytd-channel-name a',
      'a[href^="/@"]',
      'a[href*="/@"]'
    ]);
    const descEl = this._queryFirst(el, [
      '#description-text',
      '.metadata-snippet-text',
      'yt-content-metadata-view-model',
      'yt-lockup-metadata-view-model'
    ]);
    const badgesEl = el.querySelectorAll('.badge-style-type-simple, ytd-badge-supported-renderer');

    const title = (titleEl?.textContent || '').trim().toLowerCase();
    const channel = (channelEl?.textContent || '').trim();
    const channelUrl = channelEl?.href || '';
    const description = (descEl?.textContent || '').trim().toLowerCase();

    // Extract video ID from link
    const linkEl = this._queryFirst(el, [
      'a#thumbnail',
      'a.ytd-thumbnail',
      'a.ytLockupViewModelContentImage',
      'a.shortsLockupViewModelHostEndpoint.reel-item-endpoint',
      'a[href*="/watch"]',
      'a[href*="/shorts/"]'
    ]);
    const href = linkEl?.href || '';
    const videoIdMatch = href.match(/[?&]v=([^&]+)/);
    const shortsMatch = href.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : (shortsMatch ? shortsMatch[1] : '');

    // Check badges
    const badges = Array.from(badgesEl).map(b => b.textContent.trim().toLowerCase());

    return { title, channel, channelUrl, description, videoId, badges };
  },

  _normalizeVideoInfo(videoInfo) {
    const normalize = (value = '') => {
      return value
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[*_~`"'“”‘’|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    return {
      ...videoInfo,
      titleNormalized: normalize(videoInfo.title),
      descriptionNormalized: normalize(videoInfo.description),
      channelNormalized: normalize(videoInfo.channel)
    };
  },

  _detectSignals(el, videoInfo, settings, mode = 'feed') {
    const signals = [];
    const labelResult = this._checkYouTubeLabels(el);
    if (labelResult.found) {
      signals.push({
        type: 'youtubeLabel',
        strength: 'strong',
        weight: 0.95,
        reason: `YouTube label: ${labelResult.labelText}`,
        method: 'label'
      });
    }

    const keywordResult = this._checkKeywords(videoInfo, settings);
    signals.push(...keywordResult.signals);

    const patternResult = this._checkPatterns(videoInfo, settings);
    signals.push(...patternResult.signals);

    const channelResult = this._checkChannelSignals(videoInfo);
    signals.push(...channelResult.signals);

    if (mode === 'watch') {
      const disclosureText = `${videoInfo.titleNormalized} ${videoInfo.descriptionNormalized}`;
      if (/how this content was made|altered or synthetic|nội dung.*tổng hợp/.test(disclosureText)) {
        signals.push({
          type: 'watchDisclosure',
          strength: 'strong',
          weight: 0.82,
          reason: 'Watch metadata có disclosure AI',
          method: 'disclosure'
        });
      }
    }

    return signals;
  },

  _scoreSignals(signals, settings, videoInfo = {}) {
    const result = this._emptyResult();
    this._attachVideoMetadata(result, videoInfo);
    if (!Array.isArray(signals) || signals.length === 0) return result;

    const sensitivity = settings.sensitivity || 'medium';
    const profile = settings.detectionProfile || 'recall-first';
    const threshold = this._getThreshold(sensitivity, profile);
    let confidence = 0;

    const signalCounts = { strong: 0, medium: 0, weak: 0 };
    const methodWeights = {};

    for (const signal of signals) {
      confidence += signal.weight || 0;
      result.reasons.push(signal.reason);
      signalCounts[signal.strength] = (signalCounts[signal.strength] || 0) + 1;
      methodWeights[signal.method] = (methodWeights[signal.method] || 0) + (signal.weight || 0);
    }

    result.signalCounts = signalCounts;
    result.signals = signals.map((signal) => ({
      type: signal.type,
      strength: signal.strength,
      method: signal.method,
      weight: signal.weight
    }));
    result.confidence = Math.min(confidence, 1);
    result.method = this._pickMethod(methodWeights);

    const hasStrong = signalCounts.strong >= 1;
    const hasMediumCombo = signalCounts.medium >= 2;
    const hasRecallCombo = profile === 'recall-first' && signalCounts.medium >= 1 && signalCounts.weak >= 1;
    result.isAI = result.confidence >= threshold || hasStrong || hasMediumCombo || hasRecallCombo;
    if ((hasMediumCombo || hasRecallCombo) && !hasStrong && result.method === 'keyword') {
      result.method = 'combination';
    }
    if (!result.isAI) result.method = 'none';

    return result;
  },

  /**
   * Tầng 1: Kiểm tra YouTube native labels
   */
  _checkYouTubeLabels(el) {
    const result = { found: false, labelText: '' };
    if (!el || el === document.body || el === document.documentElement) return result;

    const disclosurePattern = /altered\s*(or|&)\s*synthetic|how this content was made|nội dung.*(tổng hợp|thay đổi)/i;

    // Method 1: Tìm disclosure renderer/metadata thật, không quét toàn bộ body/script.
    const labels = el.querySelectorAll([
      'ytd-info-panel-content-renderer',
      '.ytd-info-panel-container-renderer',
      'ytd-metadata-row-renderer',
      'ytd-badge-supported-renderer',
      'ytd-reel-player-overlay-renderer',
      'ytd-reel-player-header-renderer',
      'button[aria-label]',
      '[title]',
      '[aria-label]',
      'yt-formatted-string'
    ].join(','));
    for (const label of labels) {
      const text = [
        label.textContent,
        label.getAttribute?.('aria-label'),
        label.getAttribute?.('title')
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      if (disclosurePattern.test(text)) {
        result.found = true;
        result.labelText = text;
        return result;
      }
    }

    // Method 2: XPath search trong root hẹp.
    try {
      const xpath = "descendant::*[contains(normalize-space(.),'Altered or synthetic') or contains(normalize-space(.),'How this content was made') or contains(normalize-space(.),'nội dung tổng hợp') or contains(normalize-space(.),'nội dung đã thay đổi')]";
      const xpathResult = document.evaluate(xpath, el, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (xpathResult.singleNodeValue) {
        const text = (xpathResult.singleNodeValue.textContent || '').replace(/\s+/g, ' ').trim();
        if (disclosurePattern.test(text)) {
          result.found = true;
          result.labelText = text;
        }
      }
    } catch (e) { /* XPath not supported in this context */ }

    return result;
  },

  /**
   * Tầng 2a: Kiểm tra keywords trong title/description
   */
  _checkKeywords(videoInfo, settings) {
    const result = { score: 0, reasons: [], signals: [] };
    const text = `${videoInfo.titleNormalized} ${videoInfo.descriptionNormalized}`.toLowerCase();
    const keywords = settings.aiKeywords || StorageManager.DEFAULT_SETTINGS.aiKeywords;

    // High confidence keywords
    for (const kw of keywords.high) {
      if (text.includes(kw.toLowerCase())) {
        result.score += 0.55;
        result.reasons.push(`Keyword [cao]: "${kw}"`);
        result.signals.push({
          type: 'keywordHigh',
          strength: 'medium',
          weight: 0.55,
          reason: `Keyword [cao]: "${kw}"`,
          method: 'keyword'
        });
      }
    }

    // Medium confidence keywords
    for (const kw of keywords.medium) {
      if (text.includes(kw.toLowerCase())) {
        result.score += 0.3;
        result.reasons.push(`Keyword [TB]: "${kw}"`);
        result.signals.push({
          type: 'keywordMedium',
          strength: 'medium',
          weight: 0.3,
          reason: `Keyword [TB]: "${kw}"`,
          method: 'keyword'
        });
      }
    }

    // Low confidence keywords (only in high sensitivity mode)
    if (settings.sensitivity === 'high' || settings.detectionProfile === 'recall-first') {
      for (const kw of keywords.low) {
        if (text.includes(kw.toLowerCase())) {
          result.score += 0.18;
          result.reasons.push(`Keyword [thấp]: "${kw}"`);
          result.signals.push({
            type: 'keywordLow',
            strength: 'weak',
            weight: 0.18,
            reason: `Keyword [thấp]: "${kw}"`,
            method: 'keyword'
          });
        }
      }
    }

    return result;
  },

  /**
   * Tầng 2b: Kiểm tra regex patterns
   */
  _checkPatterns(videoInfo, settings) {
    const result = { score: 0, reasons: [], signals: [] };
    const text = `${videoInfo.titleNormalized} ${videoInfo.descriptionNormalized}`;

    const defaultPatterns = StorageManager.DEFAULT_SETTINGS.aiToolPatterns;
    for (const pattern of defaultPatterns) {
      if (pattern.test(text)) {
        result.score += 0.42;
        result.reasons.push(`Pattern match: ${pattern.source.substring(0, 40)}...`);
        result.signals.push({
          type: 'toolPattern',
          strength: 'medium',
          weight: 0.42,
          reason: `Pattern match: ${pattern.source.substring(0, 40)}...`,
          method: 'pattern'
        });
      }
    }

    return result;
  },

  /**
   * Phân tích tín hiệu từ channel
   */
  _checkChannelSignals(videoInfo) {
    const result = { score: 0, reasons: [], signals: [] };
    const channelLower = videoInfo.channelNormalized.toLowerCase();

    // Channel name chứa AI-related terms
    const aiChannelKeywords = ['ai video', 'ai art', 'ai studio', 'ai creator', 'ai film', 'ai movie'];
    for (const kw of aiChannelKeywords) {
      if (channelLower.includes(kw)) {
        result.score += 0.22;
        result.reasons.push(`Channel name chứa: "${kw}"`);
        result.signals.push({
          type: 'channelKeyword',
          strength: 'weak',
          weight: 0.22,
          reason: `Channel name chứa: "${kw}"`,
          method: 'channel'
        });
      }
    }

    if (/official|studio|films?|animation/.test(channelLower) && /ai/.test(channelLower)) {
      result.score += 0.2;
      result.reasons.push('Channel AI theo cụm nhận diện mở rộng');
      result.signals.push({
        type: 'channelHeuristic',
        strength: 'weak',
        weight: 0.2,
        reason: 'Channel AI theo cụm nhận diện mở rộng',
        method: 'channel'
      });
    }

    return result;
  },

  /**
   * Kiểm tra ytInitialPlayerResponse trên video page
   */
  _checkPageData(videoId = '') {
    const result = { score: 0, reasons: [] };

    try {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || '';
        const playerResponse = this._extractPlayerResponse(content);
        if (!playerResponse) continue;

        const responseVideoId = playerResponse.videoDetails?.videoId || '';
        if (videoId && responseVideoId && responseVideoId !== videoId) continue;

        const metadataText = JSON.stringify([
          playerResponse.microformat?.playerMicroformatRenderer?.category,
          playerResponse.microformat?.playerMicroformatRenderer?.description,
          playerResponse.videoDetails?.shortDescription,
          playerResponse.playerOverlays,
          playerResponse.cards
        ]);

        if (/altered\s*(or|&)\s*synthetic|how this content was made|nội dung.*(tổng hợp|thay đổi)/i.test(metadataText)) {
          result.score += 0.85;
          result.reasons.push('YouTube page data: AI disclosure found');
          break;
        }
      }
    } catch (e) { /* silent */ }

    return result;
  },

  _extractPlayerResponse(scriptText = '') {
    const marker = 'ytInitialPlayerResponse';
    const markerIndex = scriptText.indexOf(marker);
    if (markerIndex === -1) return null;

    const objectStart = scriptText.indexOf('{', markerIndex);
    if (objectStart === -1) return null;

    const jsonText = this._extractBalancedJson(scriptText, objectStart);
    if (!jsonText) return null;

    try {
      return JSON.parse(jsonText);
    } catch (e) {
      return null;
    }
  },

  _extractBalancedJson(text, startIndex) {
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];

      if (inString) {
        if (escapeNext) {
          escapeNext = false;
        } else if (char === '\\') {
          escapeNext = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) return text.slice(startIndex, i + 1);
      }
    }

    return '';
  },

  /**
   * Kiểm tra description panel trên video page
   */
  _checkDescription() {
    const result = { score: 0, reasons: [] };

    const descContainer = document.querySelector('#description-inner, ytd-text-inline-expander, #structured-description');
    if (!descContainer) return result;

    const text = descContainer.textContent.toLowerCase();
    if (/altered\s*(or|&)\s*synthetic/i.test(text) ||
        /how this content was made/i.test(text) ||
        /nội dung.*tổng hợp/i.test(text)) {
      result.score += 0.7;
      result.reasons.push('Description: AI content disclosure');
    }

    return result;
  },

  /**
   * Lấy threshold dựa trên sensitivity
   */
  _getThreshold(sensitivity, profile = 'balanced') {
    const base = profile === 'recall-first'
      ? { low: 0.58, medium: 0.42, high: 0.28 }
      : { low: 0.7, medium: 0.5, high: 0.35 };
    return base[sensitivity] || base.medium;
  },

  _pickMethod(methodWeights) {
    let bestMethod = 'none';
    let bestWeight = 0;
    for (const [method, weight] of Object.entries(methodWeights)) {
      if (weight > bestWeight) {
        bestMethod = method;
        bestWeight = weight;
      }
    }
    return bestMethod;
  },

  _extractWatchVideoId(url) {
    const match = (url || '').match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : '';
  },

  _extractShortsVideoId(url) {
    const match = (url || '').match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : '';
  },

  _extractShortsSignalsText(activeShort) {
    const selectors = [
      'ytd-reel-player-overlay-renderer #description',
      'ytd-reel-player-overlay-renderer yt-formatted-string',
      'ytd-reel-player-header-renderer h2',
      'ytd-reel-player-header-renderer #channel-name',
      'ytd-reel-video-renderer[is-active] #overlay',
      'ytd-reel-video-renderer[is-active] #details',
      'ytd-reel-video-renderer[is-active] #meta',
      '#shorts-container #description',
      '#shorts-container h2',
      '#shorts-container #channel-name'
    ];
    const root = activeShort || document;
    const chunks = [];
    for (const selector of selectors) {
      const nodes = root.querySelectorAll(selector);
      nodes.forEach((node) => {
        const text = (node.textContent || '').trim();
        if (text) chunks.push(text);
      });
    }
    return chunks.join(' ');
  },

  _checkShortsHashtags(videoInfo) {
    const rawText = `${videoInfo.title || ''} ${videoInfo.description || ''}`.toLowerCase();
    const normalizedText = `${videoInfo.titleNormalized || ''} ${videoInfo.descriptionNormalized || ''}`;
    const compactText = normalizedText.replace(/#/g, '');
    const hasExplicitHashtag = /#(aivideo|aigenerated|aigeneratedcontent|aiart|aislop|aicontent)\b/.test(rawText);
    const hasCreationPhrase = /\b(ai generated|generated by ai|made with ai|created by ai|ai video|text to video|image to video)\b/.test(compactText);
    const hasToolPhrase = /\b(sora|kling ai|runway gen|pika labs|luma dream machine|veo)\b/.test(compactText);

    if (hasExplicitHashtag || hasCreationPhrase || hasToolPhrase) {
      return {
        type: 'shortsHashtag',
        strength: 'medium',
        weight: 0.5,
        reason: 'Shorts có hashtag/cụm từ AI tạo sinh rõ ràng',
        method: 'keyword'
      };
    }

    const tokens = normalizedText.split(/\s+/).filter(Boolean);
    const hasGenericAiToken = tokens.includes('ai') || tokens.includes('#ai');
    if (hasGenericAiToken) {
      return {
        type: 'shortsGenericAiToken',
        strength: 'weak',
        weight: 0.18,
        reason: 'Shorts có token AI chung chung',
        method: 'keyword'
      };
    }
    return null;
  },

  _getShortsTitleFallback() {
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
    const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.content || '';
    const title = document.title || '';
    const merged = `${ogTitle} ${twitterTitle} ${title}`.trim();
    return merged.replace(/\s*-\s*YouTube\s*$/i, '').trim();
  },

  _getShortsChannelFallback() {
    const shortsRoot = document.querySelector('ytd-shorts, #shorts-container');
    const channelLink = shortsRoot?.querySelector('a[href^="/@"], a[href*="/@"]');
    const channelText = channelLink?.textContent?.trim();
    if (channelText) return channelText;

    const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
    const match = canonical.match(/youtube\.com\/@([^/?]+)/i);
    return match ? `@${match[1]}` : '';
  },

  _queryFirst(root, selectors = []) {
    for (const selector of selectors) {
      const node = root?.querySelector?.(selector);
      if (node) return node;
    }
    return null;
  },

  _emptyResult() {
    return {
      isAI: false,
      confidence: 0,
      method: 'none',
      reasons: [],
      signalCounts: { strong: 0, medium: 0, weak: 0 },
      signals: [],
      detectorVersion: this.DETECTOR_VERSION
    };
  },

  _attachVideoMetadata(result, videoInfo = {}) {
    result.videoId = videoInfo.videoId || '';
    result.title = videoInfo.title || '';
    result.channelName = videoInfo.channel || '';
    result.channelUrl = videoInfo.channelUrl || '';
    return result;
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.AIDetector = AIDetector;
}
