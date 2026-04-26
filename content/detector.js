/**
 * AI Video Blocker — Detector Module
 * Tầng 1: YouTube labels + metadata rules
 * Tầng 2: Child-risk scoring + caption/transcript enrichment
 */

const AIDetector = {
  DETECTOR_VERSION: 6,

  /**
   * Phân tích một video element trên feed/search.
   * @param {HTMLElement} videoElement
   * @param {object} settings
   * @returns {DetectionResult}
   */
  analyzeVideoElement(videoElement, settings) {
    if (!videoElement || !settings?.enabled) return this._emptyResult();

    const videoInfo = this._extractVideoInfo(videoElement);
    const normalizedInfo = this._normalizeVideoInfo(videoInfo);
    const signals = this._detectSignals(videoElement, normalizedInfo, settings, 'feed');
    return this._scoreSignals(signals, settings, normalizedInfo);
  },

  /**
   * Phân tích video page (khi đang xem video).
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

    const pageDataSignals = this._checkPageData(watchInfo.videoId, settings);
    signals.push(...pageDataSignals);

    const descSignals = this._checkDescription(settings);
    signals.push(...descSignals);

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

  /**
   * Hợp nhất transcript/caption hoặc metadata bổ sung vào kết quả đã có.
   */
  enrichWithText(baseDetection, text, settings, source = 'caption') {
    const base = baseDetection || this._emptyResult();
    if (!text || !settings?.enabled) return base;

    const videoInfo = this._normalizeVideoInfo({
      title: base.title || '',
      channel: base.channelName || '',
      channelUrl: base.channelUrl || '',
      description: text,
      videoId: base.videoId || '',
      badges: []
    });
    const signals = [
      ...this._detectSyntheticTextSignals(videoInfo, settings, source),
      ...this._detectChildRiskSignals(videoInfo, settings, source)
    ];

    if (signals.length === 0) return base;

    const mergedSignals = [
      ...(base.rawSignals || this._hydrateRawSignals(base.signals || [])),
      ...signals
    ];
    return this._scoreSignals(mergedSignals, settings, {
      ...videoInfo,
      title: base.title || videoInfo.title,
      channel: base.channelName || videoInfo.channel,
      channelUrl: base.channelUrl || videoInfo.channelUrl,
      videoId: base.videoId || videoInfo.videoId,
      metadataComplete: base.metadataComplete
    });
  },

  // ==================== PRIVATE METHODS ====================

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

    const title = (titleEl?.textContent || '').trim();
    const channel = (channelEl?.textContent || '').trim();
    const channelUrl = channelEl?.href || '';
    const description = (descEl?.textContent || '').trim();

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

    const title = videoInfo.title || '';
    const description = videoInfo.description || '';
    const channel = videoInfo.channel || '';
    return {
      ...videoInfo,
      titleNormalized: normalize(title),
      descriptionNormalized: normalize(description),
      channelNormalized: normalize(channel),
      metadataComplete: typeof videoInfo.metadataComplete === 'boolean'
        ? videoInfo.metadataComplete
        : Boolean(title.trim() && (description.trim() || channel.trim()))
    };
  },

  _detectSignals(el, videoInfo, settings, mode = 'feed') {
    const signals = [];
    const labelResult = this._checkYouTubeLabels(el);
    if (labelResult.found) {
      signals.push({
        type: 'youtubeLabel',
        axis: 'synthetic',
        strength: 'strong',
        weight: 0.95,
        reason: `YouTube label: ${labelResult.labelText}`,
        method: 'label'
      });
    }

    const riskLabelResult = this._checkYouTubeRiskLabels(el);
    if (riskLabelResult.found) {
      signals.push({
        type: 'youtubeRiskLabel',
        axis: 'childRisk',
        category: 'disturbing_kids_content',
        strength: 'strong',
        weight: 0.75,
        reason: `YouTube safety label: ${riskLabelResult.labelText}`,
        method: 'childRisk'
      });
    }

    signals.push(...this._detectSyntheticTextSignals(videoInfo, settings, 'metadata'));
    signals.push(...this._checkChannelSignals(videoInfo));
    signals.push(...this._detectChildRiskSignals(videoInfo, settings, 'metadata'));

    if (mode === 'watch') {
      const disclosureText = `${videoInfo.titleNormalized} ${videoInfo.descriptionNormalized}`;
      if (/how this content was made|altered or synthetic|nội dung.*tổng hợp|nội dung.*thay đổi/.test(disclosureText)) {
        signals.push({
          type: 'watchDisclosure',
          axis: 'synthetic',
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
    result.metadataComplete = Boolean(videoInfo.metadataComplete);
    if (!Array.isArray(signals) || signals.length === 0) return result;

    const signalCounts = { strong: 0, medium: 0, weak: 0 };
    const axisSignalCounts = {
      synthetic: { strong: 0, medium: 0, weak: 0 },
      childRisk: { strong: 0, medium: 0, weak: 0 }
    };
    const methodWeights = {};
    const categoryWeights = {};
    const scoredKeys = new Set();
    let syntheticScore = 0;
    let childRiskScore = 0;

    for (const signal of signals) {
      const axis = signal.axis || 'synthetic';
      const weight = Number(signal.weight || 0);
      const scoredKey = `${axis}:${signal.category || ''}:${signal.reason || signal.type}`;
      if (scoredKeys.has(scoredKey)) continue;
      scoredKeys.add(scoredKey);

      if (axis === 'childRisk') {
        childRiskScore += weight;
        if (signal.category) {
          categoryWeights[signal.category] = (categoryWeights[signal.category] || 0) + weight;
        }
      } else {
        syntheticScore += weight;
      }

      result.reasons.push(signal.reason);
      signalCounts[signal.strength] = (signalCounts[signal.strength] || 0) + 1;
      if (axisSignalCounts[axis]) {
        axisSignalCounts[axis][signal.strength] = (axisSignalCounts[axis][signal.strength] || 0) + 1;
      }
      methodWeights[signal.method] = (methodWeights[signal.method] || 0) + weight;
    }

    result.syntheticScore = Math.min(syntheticScore, 1);
    result.childRiskScore = Math.min(childRiskScore, 1);
    result.confidence = Math.max(result.syntheticScore, result.childRiskScore);
    result.signalCounts = signalCounts;
    result.axisSignalCounts = axisSignalCounts;
    result.riskCategories = Object.entries(categoryWeights)
      .filter(([, weight]) => weight >= 0.18)
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category);
    result.rawSignals = signals.slice();
    result.signals = signals.map((signal) => ({
      type: signal.type,
      axis: signal.axis || 'synthetic',
      strength: signal.strength,
      method: signal.method,
      category: signal.category,
      weight: signal.weight
    }));

    result.method = this._pickMethod(methodWeights);
    result.isAI = this._isSynthetic(result.syntheticScore, axisSignalCounts.synthetic, settings);
    result.riskLevel = this._pickRiskLevel(result, axisSignalCounts);
    result.shouldBlock = result.riskLevel === 'block' || result.isAI;

    if (result.shouldBlock && result.childRiskScore >= result.syntheticScore) {
      result.method = 'childRisk';
    } else if (result.isAI && result.method === 'keyword' && axisSignalCounts.synthetic.medium >= 2) {
      result.method = 'combination';
    } else if (!result.isAI && result.riskLevel === 'safe') {
      result.method = 'none';
    }

    result.reasons = this._prioritizeReasons(result.reasons, signals);
    return result;
  },

  _isSynthetic(score, syntheticCounts, settings) {
    const sensitivity = settings.sensitivity || 'medium';
    const profile = settings.detectionProfile || 'recall-first';
    const threshold = this._getThreshold(sensitivity, profile);
    const hasStrong = syntheticCounts.strong >= 1;
    const hasMediumCombo = syntheticCounts.medium >= 2;
    const hasRecallCombo = profile === 'recall-first' && syntheticCounts.medium >= 1 && syntheticCounts.weak >= 1;
    return score >= threshold || hasStrong || hasMediumCombo || hasRecallCombo;
  },

  _pickRiskLevel(result, axisSignalCounts) {
    const hasSyntheticLabel = result.signals.some((signal) => signal.type === 'youtubeLabel' || signal.type === 'watchDisclosure' || signal.type === 'pageData');
    const hasMediumChildRisk = axisSignalCounts.childRisk.medium >= 1 || axisSignalCounts.childRisk.strong >= 1;

    if ((hasSyntheticLabel && hasMediumChildRisk) ||
        result.childRiskScore >= 0.55 ||
        (result.syntheticScore >= 0.55 && result.childRiskScore >= 0.30)) {
      return 'block';
    }

    if (result.syntheticScore >= 0.55 || (result.childRiskScore >= 0.30 && result.childRiskScore < 0.55)) {
      return 'caution';
    }

    return 'safe';
  },

  _prioritizeReasons(reasons, signals) {
    if (!Array.isArray(signals) || signals.length === 0) return reasons;

    const ordered = [...signals].sort((a, b) => {
      if ((a.axis === 'childRisk') !== (b.axis === 'childRisk')) {
        return a.axis === 'childRisk' ? -1 : 1;
      }
      return (b.weight || 0) - (a.weight || 0);
    });

    const unique = [];
    const seen = new Set();
    for (const signal of ordered) {
      if (!signal.reason || seen.has(signal.reason)) continue;
      seen.add(signal.reason);
      unique.push(signal.reason);
    }
    return unique;
  },

  _checkYouTubeLabels(el) {
    const result = { found: false, labelText: '' };
    if (!el || el === document.body || el === document.documentElement) return result;

    const disclosurePattern = /altered\s*(or|&)\s*synthetic|how this content was made|nội dung.*(tổng hợp|thay đổi)/i;

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

  _checkYouTubeRiskLabels(el) {
    const result = { found: false, labelText: '' };
    if (!el || el === document.body || el === document.documentElement) return result;

    const riskPattern = /age[-\s]*restricted|not appropriate for viewers under 18|viewer discretion|mature content|nội dung.*(giới hạn độ tuổi|người lớn|không phù hợp.*18)/i;
    const labels = el.querySelectorAll([
      'ytd-info-panel-content-renderer',
      '.ytd-info-panel-container-renderer',
      'ytd-metadata-row-renderer',
      'ytd-badge-supported-renderer',
      'yt-formatted-string',
      '[title]',
      '[aria-label]'
    ].join(','));

    for (const label of labels) {
      const text = [
        label.textContent,
        label.getAttribute?.('aria-label'),
        label.getAttribute?.('title')
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      if (riskPattern.test(text)) {
        result.found = true;
        result.labelText = text;
        return result;
      }
    }

    return result;
  },

  _detectSyntheticTextSignals(videoInfo, settings, source = 'metadata') {
    const signals = [];
    const text = `${videoInfo.titleNormalized} ${videoInfo.descriptionNormalized}`.toLowerCase();
    const keywords = settings.syntheticKeywords || settings.aiKeywords || StorageManager.DEFAULT_SETTINGS.aiKeywords;

    this._pushKeywordSignals(signals, text, keywords.high, {
      axis: 'synthetic',
      source,
      strength: 'medium',
      weight: 0.55,
      method: 'keyword',
      label: 'AI/synthetic [cao]'
    });

    this._pushKeywordSignals(signals, text, keywords.medium, {
      axis: 'synthetic',
      source,
      strength: 'medium',
      weight: 0.3,
      method: 'keyword',
      label: 'AI/synthetic [TB]'
    });

    if (settings.sensitivity === 'high' || settings.detectionProfile === 'recall-first') {
      this._pushKeywordSignals(signals, text, keywords.low, {
        axis: 'synthetic',
        source,
        strength: 'weak',
        weight: 0.18,
        method: 'keyword',
        label: 'AI/synthetic [thấp]'
      });
    }

    const defaultPatterns = StorageManager.DEFAULT_SETTINGS.aiToolPatterns;
    for (const pattern of defaultPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        signals.push({
          type: `${source}SyntheticPattern`,
          axis: 'synthetic',
          strength: 'medium',
          weight: 0.42,
          reason: `Pattern AI/synthetic: ${pattern.source.substring(0, 40)}...`,
          method: 'pattern'
        });
      }
    }

    return signals;
  },

  _detectChildRiskSignals(videoInfo, settings, source = 'metadata') {
    const signals = [];
    const text = `${videoInfo.titleNormalized} ${videoInfo.descriptionNormalized}`.toLowerCase();
    const database = settings.childRiskKeywords || StorageManager.DEFAULT_SETTINGS.childRiskKeywords;

    for (const [category, levels] of Object.entries(database)) {
      this._pushKeywordSignals(signals, text, levels.high, {
        axis: 'childRisk',
        source,
        category,
        strength: 'strong',
        weight: 0.62,
        method: 'childRisk',
        label: `Rủi ro trẻ em/${category} [cao]`
      });
      this._pushKeywordSignals(signals, text, levels.medium, {
        axis: 'childRisk',
        source,
        category,
        strength: 'medium',
        weight: 0.34,
        method: 'childRisk',
        label: `Rủi ro trẻ em/${category} [TB]`
      });
      this._pushKeywordSignals(signals, text, levels.low, {
        axis: 'childRisk',
        source,
        category,
        strength: 'weak',
        weight: 0.16,
        method: 'childRisk',
        label: `Rủi ro trẻ em/${category} [thấp]`
      });
    }

    const patterns = StorageManager.DEFAULT_SETTINGS.childRiskPatterns || [];
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        signals.push({
          type: `${source}DisturbingKidsPattern`,
          axis: 'childRisk',
          category: 'disturbing_kids_content',
          strength: 'strong',
          weight: 0.7,
          reason: 'Pattern nội dung trẻ em bị biến tướng',
          method: 'childRisk'
        });
      }
    }

    return signals;
  },

  _pushKeywordSignals(signals, text, keywords = [], options = {}) {
    for (const kw of keywords || []) {
      if (!this._containsKeyword(text, kw)) continue;

      signals.push({
        type: `${options.source || 'metadata'}Keyword`,
        axis: options.axis || 'synthetic',
        category: options.category,
        strength: options.strength || 'weak',
        weight: options.weight || 0.1,
        reason: `${options.label}: "${kw}"`,
        method: options.method || 'keyword'
      });
    }
  },

  _containsKeyword(text, keyword) {
    const kw = this._normalizeText(keyword);
    if (!kw) return false;

    if (/^[#\wÀ-ỹ-]+$/i.test(kw) && !kw.includes(' ')) {
      const escaped = this._escapeRegExp(kw);
      return new RegExp(`(^|[^\\p{L}\\p{N}_#-])${escaped}($|[^\\p{L}\\p{N}_-])`, 'iu').test(text);
    }

    return text.includes(kw);
  },

  _checkChannelSignals(videoInfo) {
    const result = [];
    const channelLower = videoInfo.channelNormalized.toLowerCase();

    const aiChannelKeywords = ['ai video', 'ai art', 'ai studio', 'ai creator', 'ai film', 'ai movie'];
    for (const kw of aiChannelKeywords) {
      if (channelLower.includes(kw)) {
        result.push({
          type: 'channelKeyword',
          axis: 'synthetic',
          strength: 'weak',
          weight: 0.22,
          reason: `Channel name chứa: "${kw}"`,
          method: 'channel'
        });
      }
    }

    if (/official|studio|films?|animation/.test(channelLower) && /\bai\b/.test(channelLower)) {
      result.push({
        type: 'channelHeuristic',
        axis: 'synthetic',
        strength: 'weak',
        weight: 0.2,
        reason: 'Channel AI theo cụm nhận diện mở rộng',
        method: 'channel'
      });
    }

    return result;
  },

  _checkPageData(videoId = '', settings = {}) {
    const signals = [];

    try {
      const playerResponse = this.getPlayerResponse(videoId);
      if (!playerResponse) return signals;

      const metadataText = this._normalizeText(JSON.stringify([
        playerResponse.microformat?.playerMicroformatRenderer?.category,
        playerResponse.microformat?.playerMicroformatRenderer?.description,
        playerResponse.videoDetails?.shortDescription,
        playerResponse.playabilityStatus,
        playerResponse.playerOverlays,
        playerResponse.cards
      ]));

      if (/altered\s*(or|&)\s*synthetic|how this content was made|nội dung.*(tổng hợp|thay đổi)/i.test(metadataText)) {
        signals.push({
          type: 'pageData',
          axis: 'synthetic',
          strength: 'strong',
          weight: 0.9,
          reason: 'YouTube page data: AI disclosure found',
          method: 'disclosure'
        });
      }

      if (/age[-\s]*restricted|not appropriate for viewers under 18|mature content|nội dung.*(giới hạn độ tuổi|người lớn|không phù hợp.*18)/i.test(metadataText)) {
        signals.push({
          type: 'pageDataRisk',
          axis: 'childRisk',
          category: 'disturbing_kids_content',
          strength: 'strong',
          weight: 0.75,
          reason: 'YouTube page data: age/safety restriction found',
          method: 'childRisk'
        });
      }

      const pageInfo = this._normalizeVideoInfo({
        title: '',
        channel: '',
        description: metadataText,
        channelUrl: '',
        videoId,
        badges: []
      });
      signals.push(...this._detectChildRiskSignals(pageInfo, settings, 'pageData'));
    } catch (e) { /* silent */ }

    return signals;
  },

  getPlayerResponse(videoId = '') {
    const fromWindow = globalThis.ytInitialPlayerResponse;
    if (fromWindow) {
      const responseVideoId = fromWindow.videoDetails?.videoId || '';
      if (!videoId || !responseVideoId || responseVideoId === videoId) return fromWindow;
    }

    const scripts = document.querySelectorAll?.('script') || [];
    for (const script of scripts) {
      const content = script.textContent || '';
      const playerResponse = this._extractPlayerResponse(content);
      if (!playerResponse) continue;

      const responseVideoId = playerResponse.videoDetails?.videoId || '';
      if (videoId && responseVideoId && responseVideoId !== videoId) continue;
      return playerResponse;
    }

    return null;
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

  _checkDescription(settings = {}) {
    const descContainer = document.querySelector('#description-inner, ytd-text-inline-expander, #structured-description');
    if (!descContainer) return [];

    const text = descContainer.textContent || '';
    const info = this._normalizeVideoInfo({
      title: '',
      channel: '',
      description: text,
      channelUrl: '',
      videoId: '',
      badges: []
    });
    return [
      ...this._detectSyntheticTextSignals(info, settings, 'description'),
      ...this._detectChildRiskSignals(info, settings, 'description')
    ];
  },

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
        axis: 'synthetic',
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
        axis: 'synthetic',
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
      shouldBlock: false,
      confidence: 0,
      syntheticScore: 0,
      childRiskScore: 0,
      riskLevel: 'safe',
      riskCategories: [],
      method: 'none',
      reasons: [],
      signalCounts: { strong: 0, medium: 0, weak: 0 },
      axisSignalCounts: {
        synthetic: { strong: 0, medium: 0, weak: 0 },
        childRisk: { strong: 0, medium: 0, weak: 0 }
      },
      signals: [],
      rawSignals: [],
      metadataComplete: false,
      detectorVersion: this.DETECTOR_VERSION
    };
  },

  _attachVideoMetadata(result, videoInfo = {}) {
    result.videoId = videoInfo.videoId || '';
    result.title = videoInfo.title || '';
    result.channelName = videoInfo.channel || '';
    result.channelUrl = videoInfo.channelUrl || '';
    return result;
  },

  _hydrateRawSignals(signals = []) {
    return signals.map((signal) => ({
      ...signal,
      reason: signal.reason || `${signal.method || 'signal'}:${signal.type || 'unknown'}`
    }));
  },

  _normalizeText(text = '') {
    return String(text)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[*_~`"'“”‘’|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  _escapeRegExp(text = '') {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.AIDetector = AIDetector;
}
