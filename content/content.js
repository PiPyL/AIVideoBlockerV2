/**
 * AI Video Blocker — Main Content Script
 * Điều phối detector + blocker, lắng nghe DOM changes
 */

(async function() {
  'use strict';

  const LOG_PREFIX = '[AIBlocker]';
  let settings = null;
  let observer = null;
  let scanTimer = null;
  let fullScanTimer = null;
  let navigationListenerStarted = false;
  let currentPath = location.pathname;
  let currentVideoKey = getCurrentVideoKey();
  const recordedPageDecisionKeys = new Set();
  const geminiPendingKeys = new Set();

  // ==================== INITIALIZATION ====================

  async function init() {
    console.log(`${LOG_PREFIX} Initializing on ${location.href}`);
    
    settings = await StorageManager.getSettings();

    // Lắng nghe thay đổi settings
    chrome.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName !== 'local' || !changes.settings) return;

      const oldSettings = normalizeStoredSettings(changes.settings.oldValue);
      const shouldRescan = shouldRescanForSettingsChange(oldSettings, changes.settings.newValue);
      settings = await StorageManager.getSettings();

      if (!shouldRescan) return;

      console.log(`${LOG_PREFIX} Settings updated`);
      if (!settings.enabled) {
        stopObserver();
        removeAllBlocking();
      } else {
        recordedPageDecisionKeys.clear();
        resetProcessedVideoItems();
        scheduleFullScan(0, { force: true });
        startObserver();
        setupNavigationListener();
      }
    });

    // Lắng nghe messages từ service worker
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'RESCAN') {
        resetProcessedVideoItems();
        scheduleFullScan(0, { force: true });
        sendResponse({ ok: true });
      }
      if (msg.type === 'GET_STATS') {
        const blocked = document.querySelectorAll('[data-aivb-is-ai="true"]').length;
        const total = document.querySelectorAll('[data-aivb-processed="true"]').length;
        sendResponse({ blocked, total, url: location.href });
      }
      return true; // async response
    });

    if (!settings.enabled) {
      console.log(`${LOG_PREFIX} Extension disabled`);
      return;
    }

    // Scan hiện tại
    await scanAllVideos();

    // Bắt đầu observe DOM changes
    startObserver();

    // Handle SPA navigation (YouTube dùng History API)
    setupNavigationListener();

    console.log(`${LOG_PREFIX} Initialized successfully`);
  }

  // ==================== SCANNING ====================

  async function scanAllVideos(options = {}) {
    if (!settings?.enabled) return;
    const context = StorageManager.getYouTubeContext(location.pathname);
    const force = Boolean(options.force);

    const isWatchPage = location.pathname === '/watch';
    const isShortsPage = location.pathname.startsWith('/shorts/');
    
    if (isWatchPage) {
      await scanWatchPage(context, { force });
    } else {
      AIBlocker.unblockWatchPage();
    }

    if (isShortsPage) {
      await scanShortsPage(context, { force });
    } else {
      AIBlocker.unblockShortsPage();
    }

    // Scan video items trên feed, search, channel page
    await scanVideoItems(context, { force });
  }

  async function scanVideoItems(context = 'other', options = {}) {
    const force = Boolean(options.force);
    const selectors = [
      'ytd-rich-item-renderer',          // Home feed
      'ytd-video-renderer',               // Search results
      'ytd-grid-video-renderer',           // Channel videos
      'ytd-compact-video-renderer',        // Sidebar recommendations
      'ytd-reel-item-renderer',            // Legacy Shorts shelf
      'ytm-shorts-lockup-view-model',      // Current Shorts shelf/search cards
      'yt-lockup-view-model'               // Current watch recommendations
    ];

    const videoElements = document.querySelectorAll(selectors.join(','));
    let blockedCount = 0;
    let scannedCount = 0;
    let detectedMethodCounts = {};
    let detectedSignalCounts = { strong: 0, medium: 0, weak: 0 };
    const detectedRiskCategories = new Set();
    let topRiskLevel = 'safe';
    const cache = await StorageManager.getVideoCache();
    const detectorVersion = AIDetector.DETECTOR_VERSION;
    const detectionSignature = getDetectionSignature(settings, detectorVersion);
    const geminiCachedByVideoId = await getGeminiCachedDetections(videoElements);

    for (const el of videoElements) {
      if (isAggregateVideoContainer(el)) continue;

      if (el.dataset.aivbProcessed === 'true') {
        if (!force) continue;
        AIBlocker.unblockVideo(el);
      }
      scannedCount++;

      // Kiểm tra whitelist
      const channelEl = el.querySelector('#channel-name a, ytd-channel-name a, a[href^="/@"], a[href*="/@"]');
      const channelName = channelEl?.textContent?.trim() || '';
      const channelPolicy = getChannelPolicy(channelName);
      if (channelPolicy === 'whitelist') {
        el.dataset.aivbProcessed = 'true';
        el.dataset.aivbIsAi = 'false';
        continue;
      }

      // Kiểm tra blacklist (auto-block)
      if (channelPolicy === 'blacklist') {
        const forceResult = createChannelOverrideResult(channelName, 'Channel trong blacklist');
        AIBlocker.blockVideo(el, forceResult);
        blockedCount++;
        continue;
      }

      // Kiểm tra cache
      const videoId = extractVideoId(el);
      if (videoId) {
        if (cache[videoId]) {
          const cached = cache[videoId];
          const cacheValid = cached.detectorVersion === detectorVersion &&
            cached.detectionSignature === detectionSignature;
          if (cacheValid && Date.now() - cached.timestamp < getCacheTtl(cached)) {
            if (shouldBlockDetection(cached)) {
              AIBlocker.blockVideo(el, cached);
              blockedCount++;
              detectedMethodCounts[cached.method] = (detectedMethodCounts[cached.method] || 0) + 1;
              mergeSignalCounts(detectedSignalCounts, cached.signalCounts);
              mergeRiskCategories(detectedRiskCategories, cached.riskCategories);
              topRiskLevel = pickHigherRiskLevel(topRiskLevel, cached.riskLevel);
            } else {
              el.dataset.aivbProcessed = 'true';
              el.dataset.aivbIsAi = 'false';
            }
            continue;
          }
        }

        const geminiCached = geminiCachedByVideoId[videoId];
        if (geminiCached && shouldBlockDetection(geminiCached)) {
          AIBlocker.blockVideo(el, geminiCached);
          blockedCount++;
          detectedMethodCounts.gemini = (detectedMethodCounts.gemini || 0) + 1;
          mergeSignalCounts(detectedSignalCounts, geminiCached.signalCounts);
          mergeRiskCategories(detectedRiskCategories, geminiCached.riskCategories);
          topRiskLevel = pickHigherRiskLevel(topRiskLevel, geminiCached.riskLevel);
          continue;
        }
      }

      // Phát hiện AI
      const detection = AIDetector.analyzeVideoElement(el, settings);
      
      // Cache kết quả
      if (videoId && shouldCacheVideoResult(detection)) {
        await StorageManager.cacheVideoResult(videoId, {
          ...detection,
          detectorVersion,
          detectionSignature
        });
      }

      if (shouldBlockDetection(detection)) {
        AIBlocker.blockVideo(el, detection);
        blockedCount++;
        detectedMethodCounts[detection.method] = (detectedMethodCounts[detection.method] || 0) + 1;
        mergeSignalCounts(detectedSignalCounts, detection.signalCounts);
        mergeRiskCategories(detectedRiskCategories, detection.riskCategories);
        topRiskLevel = pickHigherRiskLevel(topRiskLevel, detection.riskLevel);
      }
    }

    if (scannedCount > 0) {
      await StorageManager.updateDetectionStats({
        scanned: scannedCount,
        blocked: blockedCount,
        context,
        method: getTopMethod(detectedMethodCounts),
        signalCounts: detectedSignalCounts,
        riskLevel: topRiskLevel,
        riskCategories: Array.from(detectedRiskCategories)
      });
    }

    if (blockedCount > 0) {
      console.log(`${LOG_PREFIX} Blocked ${blockedCount} videos`);
      // Notify service worker
      chrome.runtime.sendMessage({ type: 'VIDEOS_BLOCKED', count: blockedCount });
    }
  }

  async function scanWatchPage(context = 'watch') {
    // Đợi video player load
    await waitForElement('#movie_player, #player-container-inner', 5000);

    const detection = AIDetector.analyzeVideoPage(settings);
    const channelName = detection.channelName || getWatchChannelName();
    const channelPolicy = getChannelPolicy(channelName);
    let effectiveDetection = detection;

    if (channelPolicy === 'whitelist') {
      AIBlocker.releasePlaybackHold('pending-scan', { restoreMedia: true });
      AIBlocker.unblockWatchPage();
      await StorageManager.updateDetectionStats({
        scanned: 1,
        blocked: 0,
        context
      });
      return;
    }

    if (channelPolicy === 'blacklist') {
      effectiveDetection = createChannelOverrideResult(channelName, 'Channel trong blacklist', detection);
    }
    
    if (shouldBlockDetection(effectiveDetection)) {
      AIBlocker.releasePlaybackHold('pending-scan', { restoreMedia: false });
      AIBlocker.blockWatchPage(effectiveDetection);
      if (markPageDecisionRecorded(context, effectiveDetection)) {
        await StorageManager.updateDetectionStats({
          scanned: 1,
          blocked: 1,
          context,
          method: effectiveDetection.method,
          signalCounts: effectiveDetection.signalCounts,
          riskLevel: effectiveDetection.riskLevel,
          riskCategories: effectiveDetection.riskCategories
        });
        console.log(`${LOG_PREFIX} Watch page blocked:`, effectiveDetection.reasons);
      }
    } else {
      AIBlocker.releasePlaybackHold('pending-scan', { restoreMedia: true });
      AIBlocker.unblockWatchPage();
      if (markPageDecisionRecorded(context, effectiveDetection)) {
        await StorageManager.updateDetectionStats({
          scanned: 1,
          blocked: 0,
          context,
          riskLevel: effectiveDetection.riskLevel,
          riskCategories: effectiveDetection.riskCategories
        });
      }
    }

    scanCaptionAndReapply(context, effectiveDetection, 'watch');
  }

  async function scanShortsPage(context = 'shorts') {
    await waitForElement('ytd-reel-video-renderer, #shorts-player, ytd-shorts', 6000);
    const detection = AIDetector.analyzeShortsPage(settings);
    const channelName = detection.channelName || getShortsChannelName();
    const channelPolicy = getChannelPolicy(channelName);
    let effectiveDetection = detection;

    if (channelPolicy === 'whitelist') {
      AIBlocker.releasePlaybackHold('pending-scan', { restoreMedia: true });
      AIBlocker.unblockShortsPage();
      await StorageManager.updateDetectionStats({
        scanned: 1,
        blocked: 0,
        context
      });
      return;
    }

    if (channelPolicy === 'blacklist') {
      effectiveDetection = createChannelOverrideResult(channelName, 'Channel trong blacklist', detection);
    }

    if (shouldBlockDetection(effectiveDetection)) {
      AIBlocker.releasePlaybackHold('pending-scan', { restoreMedia: false });
      AIBlocker.blockShortsPage(effectiveDetection);
      if (markPageDecisionRecorded(context, effectiveDetection)) {
        await StorageManager.updateDetectionStats({
          scanned: 1,
          blocked: 1,
          context,
          method: effectiveDetection.method,
          signalCounts: effectiveDetection.signalCounts,
          riskLevel: effectiveDetection.riskLevel,
          riskCategories: effectiveDetection.riskCategories
        });
        console.log(`${LOG_PREFIX} Shorts page blocked:`, effectiveDetection.reasons);
      }
    } else {
      AIBlocker.releasePlaybackHold('pending-scan', { restoreMedia: true });
      AIBlocker.unblockShortsPage();
      if (markPageDecisionRecorded(context, effectiveDetection)) {
        await StorageManager.updateDetectionStats({
          scanned: 1,
          blocked: 0,
          context,
          riskLevel: effectiveDetection.riskLevel,
          riskCategories: effectiveDetection.riskCategories
        });
      }
    }

    scanCaptionAndReapply(context, effectiveDetection, 'shorts');
  }

  async function scanCaptionAndReapply(context, baseDetection, surface) {
    const videoId = baseDetection?.videoId || extractVideoIdFromUrl(location.href);
    if (!videoId) return;

    let workingDetection = baseDetection;
    let captionText = '';

    try {
      if (settings?.captionScan?.enabled) {
        captionText = await getCaptionText(videoId);
      }

      if (captionText && videoId === extractVideoIdFromUrl(location.href)) {
        const enriched = AIDetector.enrichWithText(baseDetection, captionText, settings, 'caption');
        if (shouldBlockDetection(enriched)) {
          if (surface === 'shorts') {
            AIBlocker.blockShortsPage(enriched);
          } else {
            AIBlocker.blockWatchPage(enriched);
          }

          if (markPageDecisionRecorded(context, enriched)) {
            await StorageManager.updateDetectionStats({
              scanned: 0,
              blocked: shouldBlockDetection(baseDetection) ? 0 : 1,
              context,
              method: enriched.method,
              signalCounts: enriched.signalCounts,
              riskLevel: enriched.riskLevel,
              riskCategories: enriched.riskCategories
            });
            chrome.runtime.sendMessage({ type: 'VIDEOS_BLOCKED', count: 1 });
          }

          console.log(`${LOG_PREFIX} ${surface} caption risk blocked:`, enriched.reasons);
          return;
        }

        workingDetection = enriched;
      }
    } catch (e) {
      console.warn(`${LOG_PREFIX} Caption scan skipped:`, e);
    }

    scanGeminiAndReapply(context, workingDetection, surface, captionText);
  }

  async function getCaptionText(videoId) {
    const track = getPreferredCaptionTrack(videoId);
    if (!track?.baseUrl) return '';

    const trackKey = getCaptionTrackKey(videoId, track);
    const cached = await StorageManager.getCaptionCacheEntry(trackKey);
    const captionTtl = 24 * 60 * 60 * 1000;
    if (cached && Date.now() - cached.timestamp < captionTtl) {
      return cached.text || '';
    }

    const text = await fetchCaptionText(track.baseUrl);
    if (text) {
      await StorageManager.cacheCaptionText(trackKey, {
        text,
        detectorVersion: AIDetector.DETECTOR_VERSION
      });
    }
    return text;
  }

  function getPreferredCaptionTrack(videoId) {
    const playerResponse = AIDetector.getPlayerResponse(videoId);
    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    if (!tracks.length) return null;

    const preferredLanguages = settings.captionScan?.preferredLanguages || ['vi', 'en'];
    for (const lang of preferredLanguages) {
      const exact = tracks.find((track) => normalizeLang(track.languageCode) === normalizeLang(lang));
      if (exact) return exact;

      const prefix = tracks.find((track) => normalizeLang(track.languageCode).startsWith(`${normalizeLang(lang)}-`));
      if (prefix) return prefix;
    }

    return tracks[0];
  }

  function getCaptionTrackKey(videoId, track) {
    const parts = [
      videoId,
      AIDetector.DETECTOR_VERSION,
      track.languageCode || '',
      track.vssId || '',
      track.kind || '',
      track.name?.simpleText || ''
    ];
    return parts.join(':');
  }

  async function fetchCaptionText(baseUrl) {
    const timeoutMs = Number(settings.captionScan?.timeoutMs || 2000);
    const maxChars = Number(settings.captionScan?.maxChars || 5000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = withQueryParam(baseUrl, 'fmt', 'json3');
      const response = await fetch(url, { signal: controller.signal, credentials: 'include' });
      if (!response.ok) return '';

      const raw = await response.text();
      const parsedText = parseCaptionResponse(raw);
      return parsedText.slice(0, maxChars);
    } finally {
      clearTimeout(timer);
    }
  }

  function parseCaptionResponse(raw) {
    try {
      const json = JSON.parse(raw);
      const chunks = [];
      for (const event of json.events || []) {
        for (const segment of event.segs || []) {
          if (segment.utf8) chunks.push(segment.utf8);
        }
      }
      return chunks.join(' ').replace(/\s+/g, ' ').trim();
    } catch (e) {
      return decodeHtml(raw)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  async function getGeminiCachedDetections(videoElements) {
    if (!settings?.gemini?.enabled || !settings?.gemini?.apiKey) return {};

    const videoIds = [...new Set(Array.from(videoElements)
      .filter((el) => !isAggregateVideoContainer(el))
      .map(extractVideoId)
      .filter(Boolean))];

    if (videoIds.length === 0) return {};

    try {
      const response = await sendRuntimeMessage({
        type: 'GET_GEMINI_CACHE_BATCH',
        videoIds
      });
      return response?.detections || {};
    } catch (e) {
      return {};
    }
  }

  async function scanGeminiAndReapply(context, baseDetection, surface, captionText = '') {
    if (!settings?.gemini?.enabled || !settings?.gemini?.apiKey) return;
    if (shouldBlockDetection(baseDetection)) return;

    const videoId = baseDetection?.videoId || extractVideoIdFromUrl(location.href);
    if (!videoId) return;

    const pendingKey = [
      surface,
      videoId,
      settings.gemini.model || '',
      settings.gemini.includeThumbnail ? 'thumb' : 'text'
    ].join(':');
    if (geminiPendingKeys.has(pendingKey)) return;
    geminiPendingKeys.add(pendingKey);

    try {
      const response = await sendRuntimeMessage({
        type: 'GEMINI_CLASSIFY_VIDEO',
        payload: buildGeminiPayload(videoId, baseDetection, surface, captionText)
      });

      if (!response?.ok || !response.detection) return;
      if (videoId !== extractVideoIdFromUrl(location.href)) return;

      const merged = mergeGeminiDetection(baseDetection, response.detection);
      if (!shouldBlockDetection(merged)) return;

      if (surface === 'shorts') {
        AIBlocker.blockShortsPage(merged);
      } else {
        AIBlocker.blockWatchPage(merged);
      }

      if (markPageDecisionRecorded(context, merged)) {
        await StorageManager.updateDetectionStats({
          scanned: 0,
          blocked: 1,
          context,
          method: 'gemini',
          signalCounts: merged.signalCounts,
          riskLevel: merged.riskLevel,
          riskCategories: merged.riskCategories
        });
        chrome.runtime.sendMessage({ type: 'VIDEOS_BLOCKED', count: 1 });
      }

      console.log(`${LOG_PREFIX} ${surface} Gemini blocked:`, merged.reasons);
    } catch (e) {
      console.warn(`${LOG_PREFIX} Gemini scan skipped:`, e?.message || e);
    } finally {
      geminiPendingKeys.delete(pendingKey);
    }
  }

  function buildGeminiPayload(videoId, detection = {}, surface = 'watch', captionText = '') {
    const maxCaptionChars = Number(settings.gemini?.maxCaptionChars || 4000);
    return {
      videoId,
      title: detection.title || getCurrentVideoTitle(surface),
      channel: detection.channelName || (surface === 'shorts' ? getShortsChannelName() : getWatchChannelName()),
      description: getCurrentDescriptionText(videoId, surface),
      captionExcerpt: String(captionText || '').slice(0, maxCaptionChars),
      thumbnailUrl: getThumbnailUrl(videoId),
      detectorVersion: AIDetector.DETECTOR_VERSION,
      localDetection: {
        isAI: Boolean(detection.isAI),
        shouldBlock: shouldBlockDetection(detection),
        syntheticScore: detection.syntheticScore || 0,
        childRiskScore: detection.childRiskScore || 0,
        riskLevel: detection.riskLevel || 'safe',
        riskCategories: detection.riskCategories || [],
        reasons: detection.reasons || [],
        title: detection.title || '',
        channelName: detection.channelName || ''
      }
    };
  }

  function mergeGeminiDetection(baseDetection = {}, geminiDetection = {}) {
    return {
      ...baseDetection,
      ...geminiDetection,
      videoId: baseDetection.videoId || geminiDetection.videoId || extractVideoIdFromUrl(location.href),
      title: baseDetection.title || geminiDetection.title || '',
      channelName: baseDetection.channelName || geminiDetection.channelName || '',
      channelUrl: baseDetection.channelUrl || '',
      isAI: Boolean(baseDetection.isAI || geminiDetection.isAI),
      shouldBlock: shouldBlockDetection(geminiDetection) || shouldBlockDetection(baseDetection),
      syntheticScore: Math.max(baseDetection.syntheticScore || 0, geminiDetection.syntheticScore || geminiDetection.aiConfidence || 0),
      childRiskScore: Math.max(baseDetection.childRiskScore || 0, geminiDetection.childRiskScore || 0),
      confidence: Math.max(baseDetection.confidence || 0, geminiDetection.confidence || 0),
      method: 'gemini',
      reasons: geminiDetection.reasons?.length ? geminiDetection.reasons : ['Gemini đánh giá cần chặn video này'],
      signals: geminiDetection.signals || [],
      signalCounts: geminiDetection.signalCounts || { strong: 1, medium: 0, weak: 0 },
      axisSignalCounts: geminiDetection.axisSignalCounts || baseDetection.axisSignalCounts || {
        synthetic: { strong: 0, medium: 0, weak: 0 },
        childRisk: { strong: 0, medium: 0, weak: 0 }
      },
      riskCategories: geminiDetection.riskCategories || baseDetection.riskCategories || [],
      riskLevel: geminiDetection.riskLevel || baseDetection.riskLevel || 'safe'
    };
  }

  function getCurrentDescriptionText(videoId, surface = 'watch') {
    const playerResponse = AIDetector.getPlayerResponse(videoId);
    const responseDescription = playerResponse?.videoDetails?.shortDescription ||
      playerResponse?.microformat?.playerMicroformatRenderer?.description?.simpleText ||
      playerResponse?.microformat?.playerMicroformatRenderer?.description ||
      '';

    if (responseDescription) return normalizeLongText(responseDescription).slice(0, 2500);

    const selector = surface === 'shorts'
      ? 'ytd-reel-player-overlay-renderer #description, ytd-reel-video-renderer[is-active] #description, #shorts-container #description'
      : '#description-inner, ytd-text-inline-expander, #structured-description, ytd-watch-metadata #description';
    const node = document.querySelector(selector);
    return normalizeLongText(node?.textContent || '').slice(0, 2500);
  }

  function getCurrentVideoTitle(surface = 'watch') {
    const selector = surface === 'shorts'
      ? 'ytd-reel-video-renderer[is-active] #shorts-title, #shorts-title, h2#shorts-video-title'
      : 'h1.ytd-watch-metadata yt-formatted-string, h1.ytd-video-primary-info-renderer';
    const node = document.querySelector(selector);
    return normalizeLongText(node?.textContent || document.title.replace(/\s*-\s*YouTube\s*$/i, ''));
  }

  function getThumbnailUrl(videoId) {
    return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
  }

  function normalizeLongText(text = '') {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  // ==================== DOM OBSERVATION ====================

  function startObserver() {
    if (observer) return;

    const target = document.querySelector('ytd-app') || document.body;
    
    observer = new MutationObserver((mutations) => {
      let hasNewVideos = false;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          
          const tagName = node.tagName?.toLowerCase() || '';
          if (tagName.includes('ytd-rich-item') || 
              tagName.includes('ytd-video-renderer') ||
              tagName.includes('ytd-compact-video') ||
              tagName.includes('ytd-grid-video') ||
              tagName.includes('ytd-reel-item') ||
              tagName.includes('ytm-shorts-lockup') ||
              tagName.includes('yt-lockup-view-model')) {
            hasNewVideos = true;
            break;
          }

          // Kiểm tra children
          if (node.querySelector?.('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytm-shorts-lockup-view-model, yt-lockup-view-model')) {
            hasNewVideos = true;
            break;
          }
        }
        if (hasNewVideos) break;
      }

      if (hasNewVideos) {
        if (location.pathname === '/watch' || location.pathname.startsWith('/shorts/')) {
          scheduleFullScan(350);
        } else {
          debouncedScan();
        }
      }
    });

    observer.observe(target, {
      childList: true,
      subtree: true
    });

    console.log(`${LOG_PREFIX} MutationObserver started`);
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function debouncedScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scanVideoItems(StorageManager.getYouTubeContext(location.pathname));
    }, 300);
  }

  // ==================== SPA NAVIGATION ====================

  function setupNavigationListener() {
    if (navigationListenerStarted) return;
    navigationListenerStarted = true;

    // YouTube dùng History API cho navigation
    let lastUrl = location.href;

    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log(`${LOG_PREFIX} Navigation detected: ${lastUrl}`);
        
        const nextVideoKey = getCurrentVideoKey();
        const routeChanged = currentPath !== location.pathname || currentVideoKey !== nextVideoKey;
        currentPath = location.pathname;
        currentVideoKey = nextVideoKey;

        if (routeChanged) {
          prepareForNavigationScan();
        }
        scheduleFullScan(650, { force: routeChanged });
      }
    });

    const titleEl = document.querySelector('title');
    if (titleEl) {
      urlObserver.observe(titleEl, { childList: true });
    }

    // Fallback: listen to yt-navigate-finish event
    document.addEventListener('yt-navigate-finish', () => {
      console.log(`${LOG_PREFIX} yt-navigate-finish event`);
      prepareForNavigationScan();
      scheduleFullScan(500, { force: true });
    });

    document.addEventListener('yt-page-data-updated', () => {
      scheduleFullScan(350, { force: true });
    });
  }

  // ==================== UTILITIES ====================

  function extractVideoId(el) {
    const linkEl = el.querySelector('a#thumbnail, a.ytd-thumbnail, a[href*="/watch"], a[href*="/shorts/"]');
    const href = linkEl?.href || '';
    const watchMatch = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];
    const shortsMatch = href.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    return shortsMatch ? shortsMatch[1] : '';
  }

  function shouldBlockDetection(detection = {}) {
    if (!detection) return false;
    if (typeof detection.shouldBlock === 'boolean') return detection.shouldBlock;
    if (detection.riskLevel) return detection.riskLevel === 'block';
    return Boolean(detection.isAI);
  }

  function shouldCacheVideoResult(detection = {}) {
    if (shouldBlockDetection(detection)) return true;
    return Boolean(detection.metadataComplete);
  }

  function getCacheTtl(detection = {}) {
    return shouldBlockDetection(detection)
      ? 24 * 60 * 60 * 1000
      : 2 * 60 * 60 * 1000;
  }

  function isAggregateVideoContainer(el) {
    if (!el?.matches?.('ytd-video-renderer')) return false;
    return el.querySelectorAll('ytm-shorts-lockup-view-model').length > 1;
  }

  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const timer = setTimeout(() => {
        obs.disconnect();
        resolve(null);
      }, timeout);

      const obs = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearTimeout(timer);
          obs.disconnect();
          resolve(el);
        }
      });

      obs.observe(document.body, { childList: true, subtree: true });
    });
  }

  function scheduleFullScan(delay = 300, options = {}) {
    if (fullScanTimer) clearTimeout(fullScanTimer);
    fullScanTimer = setTimeout(() => {
      fullScanTimer = null;
      scanAllVideos(options);
    }, delay);
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || {});
      });
    });
  }

  function prepareForNavigationScan() {
    resetProcessedVideoItems();
    AIBlocker.resetPageBlocks({ restoreMedia: false });

    if (location.pathname === '/watch' || location.pathname.startsWith('/shorts/')) {
      AIBlocker.holdPlayback('pending-scan');
    } else {
      AIBlocker.releasePlaybackHold('pending-scan', { restoreMedia: true });
    }
  }

  function resetProcessedVideoItems() {
    document.querySelectorAll('[data-aivb-processed="true"]').forEach((node) => {
      AIBlocker.unblockVideo(node);
      delete node.dataset.aivbProcessed;
      delete node.dataset.aivbIsAi;
      delete node.dataset.aivbConfidence;
      delete node.dataset.aivbMethod;
    });
  }

  function removeAllBlocking() {
    if (scanTimer) clearTimeout(scanTimer);
    if (fullScanTimer) clearTimeout(fullScanTimer);
    AIBlocker.releasePlaybackHold('pending-scan', { restoreMedia: true });
    AIBlocker.resetPageBlocks({ restoreMedia: true });

    const blocked = document.querySelectorAll('[data-aivb-processed]');
    blocked.forEach(el => AIBlocker.unblockVideo(el));
  }

  function mergeSignalCounts(total, delta = {}) {
    for (const level of ['strong', 'medium', 'weak']) {
      total[level] = (total[level] || 0) + Number(delta[level] || 0);
    }
  }

  function mergeRiskCategories(total, categories = []) {
    for (const category of categories || []) {
      total.add(category);
    }
  }

  function pickHigherRiskLevel(current = 'safe', next = 'safe') {
    const rank = { safe: 0, caution: 1, block: 2 };
    return (rank[next] || 0) > (rank[current] || 0) ? next : current;
  }

  function getTopMethod(methodCounts) {
    let topMethod = 'none';
    let topValue = 0;
    Object.entries(methodCounts).forEach(([method, value]) => {
      if (value > topValue) {
        topMethod = method;
        topValue = value;
      }
    });
    return topMethod;
  }

  function getDetectionSignature(currentSettings, detectorVersion) {
    const keywords = currentSettings.aiKeywords || StorageManager.DEFAULT_SETTINGS.aiKeywords;
    const syntheticKeywords = currentSettings.syntheticKeywords || keywords;
    const childRiskKeywords = currentSettings.childRiskKeywords || StorageManager.DEFAULT_SETTINGS.childRiskKeywords;
    return JSON.stringify({
      detectorVersion,
      sensitivity: currentSettings.sensitivity || 'medium',
      detectionProfile: currentSettings.detectionProfile || 'recall-first',
      aiKeywords: keywords,
      syntheticKeywords,
      childRiskKeywords,
      captionScan: currentSettings.captionScan || StorageManager.DEFAULT_SETTINGS.captionScan,
      gemini: {
        enabled: Boolean(currentSettings.gemini?.enabled),
        model: currentSettings.gemini?.model || '',
        includeThumbnail: Boolean(currentSettings.gemini?.includeThumbnail)
      }
    });
  }

  function markPageDecisionRecorded(context, detection = {}) {
    const detectorVersion = AIDetector.DETECTOR_VERSION;
    const signature = getDetectionSignature(settings, detectorVersion);
    const videoId = detection.videoId || extractVideoIdFromUrl(location.href) || getCurrentVideoKey();
    const decision = shouldBlockDetection(detection) ? 'blocked' : (detection.riskLevel || 'allowed');
    const key = `${context}:${videoId}:${decision}:${detection.method || 'none'}:${signature}`;

    if (recordedPageDecisionKeys.has(key)) return false;

    if (recordedPageDecisionKeys.size > 100) {
      recordedPageDecisionKeys.clear();
    }

    recordedPageDecisionKeys.add(key);
    return true;
  }

  function normalizeStoredSettings(value = {}) {
    const normalized = { ...StorageManager.DEFAULT_SETTINGS, ...(value || {}) };
    normalized.gemini = { ...StorageManager.DEFAULT_SETTINGS.gemini, ...(value?.gemini || {}) };
    normalized.captionScan = { ...StorageManager.DEFAULT_SETTINGS.captionScan, ...(value?.captionScan || {}) };
    return normalized;
  }

  function shouldRescanForSettingsChange(previousSettings = {}, nextSettings = {}) {
    const previous = normalizeStoredSettings(previousSettings);
    const next = normalizeStoredSettings(nextSettings);
    const relevantKeys = [
      'enabled',
      'sensitivity',
      'detectionProfile',
      'detectorVersion',
      'whitelistedChannels',
      'blacklistedChannels',
      'aiKeywords',
      'syntheticKeywords',
      'childRiskKeywords',
      'captionScan',
      'gemini'
    ];

    return relevantKeys.some((key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]));
  }

  function normalizeChannelName(name = '') {
    return name
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getChannelPolicy(channelName = '') {
    const normalizedChannel = normalizeChannelName(channelName);
    if (!normalizedChannel) return 'none';

    const whitelist = settings.whitelistedChannels || [];
    if (whitelist.some((name) => normalizeChannelName(name) === normalizedChannel)) {
      return 'whitelist';
    }

    const blacklist = settings.blacklistedChannels || [];
    if (blacklist.some((name) => normalizeChannelName(name) === normalizedChannel)) {
      return 'blacklist';
    }

    return 'none';
  }

  function createChannelOverrideResult(channelName, reason, base = {}) {
    return {
      ...base,
      isAI: true,
      shouldBlock: true,
      confidence: 1,
      syntheticScore: Math.max(base.syntheticScore || 0, 1),
      childRiskScore: Math.max(base.childRiskScore || 0, 0),
      riskLevel: 'block',
      riskCategories: base.riskCategories || [],
      method: 'channel',
      reasons: [reason],
      signalCounts: { strong: 1, medium: 0, weak: 0 },
      axisSignalCounts: {
        synthetic: { strong: 1, medium: 0, weak: 0 },
        childRisk: base.axisSignalCounts?.childRisk || { strong: 0, medium: 0, weak: 0 }
      },
      signals: [{
        type: 'channelOverride',
        axis: 'synthetic',
        strength: 'strong',
        method: 'channel',
        weight: 1
      }],
      detectorVersion: AIDetector.DETECTOR_VERSION,
      videoId: base.videoId || extractVideoIdFromUrl(location.href),
      channelName: channelName || base.channelName || '',
      channelUrl: base.channelUrl || ''
    };
  }

  function normalizeLang(lang = '') {
    return String(lang).toLowerCase().replace('_', '-');
  }

  function withQueryParam(rawUrl, key, value) {
    try {
      const url = new URL(rawUrl, location.href);
      url.searchParams.set(key, value);
      return url.toString();
    } catch (e) {
      const separator = rawUrl.includes('?') ? '&' : '?';
      return `${rawUrl}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }
  }

  function decodeHtml(text = '') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  function getWatchChannelName() {
    const channelEl = document.querySelector('#owner #channel-name a, #upload-info ytd-channel-name a, ytd-watch-metadata ytd-channel-name a');
    return channelEl?.textContent?.trim() || '';
  }

  function getShortsChannelName() {
    const activeShort = document.querySelector('ytd-reel-video-renderer[is-active], ytd-reel-video-renderer');
    const channelEl = activeShort?.querySelector('ytd-channel-name a, #channel-name a, a[href^="/@"]') ||
      document.querySelector('ytd-reel-player-header-renderer ytd-channel-name a, ytd-reel-player-header-renderer a[href^="/@"], ytd-reel-player-overlay-renderer a[href^="/@"], ytd-shorts a[href^="/@"]');
    return channelEl?.textContent?.trim() || '';
  }

  function extractVideoIdFromUrl(url = '') {
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];

    const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    return shortsMatch ? shortsMatch[1] : '';
  }

  function getCurrentVideoKey() {
    const videoId = extractVideoIdFromUrl(location.href);
    return `${location.pathname}:${videoId}`;
  }

  // ==================== START ====================

  // Đợi DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
