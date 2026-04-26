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
      'ytd-reel-item-renderer'             // Shorts
    ];

    const videoElements = document.querySelectorAll(selectors.join(','));
    let blockedCount = 0;
    let scannedCount = 0;
    let detectedMethodCounts = {};
    let detectedSignalCounts = { strong: 0, medium: 0, weak: 0 };
    const cache = await StorageManager.getVideoCache();
    const detectorVersion = AIDetector.DETECTOR_VERSION;
    const detectionSignature = getDetectionSignature(settings, detectorVersion);

    for (const el of videoElements) {
      if (el.dataset.aivbProcessed === 'true') {
        if (!force) continue;
        AIBlocker.unblockVideo(el);
      }
      scannedCount++;

      // Kiểm tra whitelist
      const channelEl = el.querySelector('#channel-name a, ytd-channel-name a');
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
        AIBlocker.blockVideo(el, forceResult, settings.blockMode);
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
          if (cacheValid && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) { // 24h cache
            if (cached.isAI) {
              AIBlocker.blockVideo(el, cached, settings.blockMode);
              blockedCount++;
              detectedMethodCounts[cached.method] = (detectedMethodCounts[cached.method] || 0) + 1;
              mergeSignalCounts(detectedSignalCounts, cached.signalCounts);
            } else {
              el.dataset.aivbProcessed = 'true';
              el.dataset.aivbIsAi = 'false';
            }
            continue;
          }
        }
      }

      // Phát hiện AI
      const detection = AIDetector.analyzeVideoElement(el, settings);
      
      // Cache kết quả
      if (videoId) {
        await StorageManager.cacheVideoResult(videoId, {
          ...detection,
          detectorVersion,
          detectionSignature
        });
      }

      if (detection.isAI) {
        AIBlocker.blockVideo(el, detection, settings.blockMode);
        blockedCount++;
        detectedMethodCounts[detection.method] = (detectedMethodCounts[detection.method] || 0) + 1;
        mergeSignalCounts(detectedSignalCounts, detection.signalCounts);
      }
    }

    if (scannedCount > 0) {
      await StorageManager.updateDetectionStats({
        scanned: scannedCount,
        blocked: blockedCount,
        context,
        method: getTopMethod(detectedMethodCounts),
        signalCounts: detectedSignalCounts
      });
    }

    if (blockedCount > 0) {
      console.log(`${LOG_PREFIX} Blocked ${blockedCount} AI videos`);
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
    
    if (effectiveDetection.isAI) {
      AIBlocker.releasePlaybackHold('pending-scan', { restoreMedia: false });
      AIBlocker.blockWatchPage(effectiveDetection);
      if (markPageDecisionRecorded(context, effectiveDetection)) {
        await StorageManager.updateDetectionStats({
          scanned: 1,
          blocked: 1,
          context,
          method: effectiveDetection.method,
          signalCounts: effectiveDetection.signalCounts
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
          context
        });
      }
    }
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

    if (effectiveDetection.isAI) {
      AIBlocker.releasePlaybackHold('pending-scan', { restoreMedia: false });
      const playbackBlockMode = settings.blockMode === 'badge' ? 'blur' : settings.blockMode;
      AIBlocker.blockShortsPage(effectiveDetection, playbackBlockMode);
      if (markPageDecisionRecorded(context, effectiveDetection)) {
        await StorageManager.updateDetectionStats({
          scanned: 1,
          blocked: 1,
          context,
          method: effectiveDetection.method,
          signalCounts: effectiveDetection.signalCounts
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
          context
        });
      }
    }
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
              tagName.includes('ytd-reel-item')) {
            hasNewVideos = true;
            break;
          }

          // Kiểm tra children
          if (node.querySelector?.('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer')) {
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
    const linkEl = el.querySelector('a#thumbnail, a.ytd-thumbnail, a[href*="watch"]');
    const href = linkEl?.href || '';
    const watchMatch = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];
    const shortsMatch = href.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    return shortsMatch ? shortsMatch[1] : '';
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
    return JSON.stringify({
      detectorVersion,
      sensitivity: currentSettings.sensitivity || 'medium',
      detectionProfile: currentSettings.detectionProfile || 'recall-first',
      aiKeywords: keywords
    });
  }

  function markPageDecisionRecorded(context, detection = {}) {
    const detectorVersion = AIDetector.DETECTOR_VERSION;
    const signature = getDetectionSignature(settings, detectorVersion);
    const videoId = detection.videoId || extractVideoIdFromUrl(location.href) || getCurrentVideoKey();
    const key = `${context}:${videoId}:${detection.isAI ? 'blocked' : 'allowed'}:${detection.method || 'none'}:${signature}`;

    if (recordedPageDecisionKeys.has(key)) return false;

    if (recordedPageDecisionKeys.size > 100) {
      recordedPageDecisionKeys.clear();
    }

    recordedPageDecisionKeys.add(key);
    return true;
  }

  function normalizeStoredSettings(value = {}) {
    return { ...StorageManager.DEFAULT_SETTINGS, ...(value || {}) };
  }

  function shouldRescanForSettingsChange(previousSettings = {}, nextSettings = {}) {
    const previous = normalizeStoredSettings(previousSettings);
    const next = normalizeStoredSettings(nextSettings);
    const relevantKeys = [
      'enabled',
      'sensitivity',
      'blockMode',
      'detectionProfile',
      'detectorVersion',
      'whitelistedChannels',
      'blacklistedChannels',
      'aiKeywords'
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
      confidence: 1,
      method: 'channel',
      reasons: [reason],
      signalCounts: { strong: 1, medium: 0, weak: 0 },
      signals: [{
        type: 'channelOverride',
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

  function getWatchChannelName() {
    const channelEl = document.querySelector('#owner #channel-name a, #upload-info ytd-channel-name a, ytd-watch-metadata ytd-channel-name a');
    return channelEl?.textContent?.trim() || '';
  }

  function getShortsChannelName() {
    const activeShort = document.querySelector('ytd-reel-video-renderer[is-active], ytd-reel-video-renderer');
    const channelEl = activeShort?.querySelector('ytd-channel-name a, #channel-name a, a[href^="/@"]') ||
      document.querySelector('ytd-reel-player-header-renderer ytd-channel-name a, ytd-reel-player-header-renderer a[href^="/@"]');
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
