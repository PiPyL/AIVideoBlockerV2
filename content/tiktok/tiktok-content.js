/**
 * SafeKid — TikTok Content Script
 * Entry point for TikTok channel blocking.
 * Only manual channel whitelist/blacklist — no AI detection.
 */

(async function () {
  'use strict';

  const LOG_PREFIX = '[SafeKid:TikTok]';
  let settings = null;
  let tiktokSettings = null;
  let observer = null;
  let scanTimer = null;
  let lastUrl = location.href;

  async function init() {
    console.log(`${LOG_PREFIX} Initializing on ${location.href}`);
    settings = await StorageManager.getSettings();
    tiktokSettings = settings.tiktok || {};

    if (!settings.enabled || !tiktokSettings.enabled) {
      console.log(`${LOG_PREFIX} Disabled`);
      return;
    }

    chrome.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName !== 'local' || !changes.settings) return;
      settings = await StorageManager.getSettings();
      tiktokSettings = settings.tiktok || {};
      if (!settings.enabled || !tiktokSettings.enabled) {
        stopObserver();
        removeAllBlocking();
      } else {
        removeAllBlocking();
        await scanAll();
        startObserver();
      }
    });

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'RESCAN') {
        removeAllBlocking();
        scheduleScan(0);
        sendResponse({ ok: true });
      }
      if (msg.type === 'GET_STATS') {
        const blocked = document.querySelectorAll('[data-safekid-tt-processed="blocked"]').length;
        sendResponse({ blocked, url: location.href, platform: 'tiktok' });
      }
      return true;
    });

    await scanAll();
    startObserver();
    setupNavigationListener();
    console.log(`${LOG_PREFIX} Initialized`);
  }

  async function scanAll() {
    if (!settings?.enabled || !tiktokSettings?.enabled) return;
    const context = TikTokPlatform.getPageContext();

    if (context === 'video' || context === 'profile') {
      scanFullPage(context);
    } else {
      TikTokBlocker.unblockAllPages();
    }
    scanFeedItems();
  }

  function scanFullPage(context) {
    const pageUsername = TikTokPlatform.getPageUsername();
    if (!pageUsername) return;
    const policy = getChannelPolicy(pageUsername);

    if (policy === 'whitelist') {
      TikTokBlocker.unblockAllPages();
      return;
    }
    if (policy === 'blacklist' || isAllowOnlyMode()) {
      const reason = policy === 'blacklist'
        ? 'Kênh nằm trong danh sách chặn'
        : 'Kênh không nằm trong danh sách được phép';
      if (context === 'video') {
        TikTokBlocker.blockVideoPage(pageUsername, reason);
      } else {
        TikTokBlocker.blockProfilePage(pageUsername, reason);
      }
      updateStats(1, 1);
      return;
    }
    TikTokBlocker.unblockAllPages();
  }

  function scanFeedItems() {
    const selectorString = TikTokPlatform.videoItemSelectors.join(',');
    const items = document.querySelectorAll(selectorString);
    let scanned = 0;
    let blocked = 0;

    for (const item of items) {
      if (item.dataset.safekidTtProcessed) continue;
      scanned++;
      const username = TikTokPlatform.extractUsername(item);
      if (!username) { item.dataset.safekidTtProcessed = 'skipped'; continue; }

      const policy = getChannelPolicy(username);
      if (policy === 'whitelist') { item.dataset.safekidTtProcessed = 'allowed'; continue; }
      if (policy === 'blacklist') {
        TikTokBlocker.blockVideoItem(item, username, 'Kênh nằm trong danh sách chặn');
        blocked++;
        continue;
      }
      if (isAllowOnlyMode()) {
        TikTokBlocker.blockVideoItem(item, username, 'Kênh không nằm trong danh sách được phép');
        blocked++;
        continue;
      }
      item.dataset.safekidTtProcessed = 'allowed';
    }

    if (blocked > 0) {
      console.log(`${LOG_PREFIX} Blocked ${blocked}/${scanned} items`);
      updateStats(scanned, blocked);
    }
  }

  function getChannelPolicy(username) {
    if (!username) return 'none';
    const normalized = TikTokPlatform.normalizeUsername(username);
    const wl = tiktokSettings.whitelistedChannels || [];
    if (wl.some(e => TikTokPlatform.normalizeUsername(e) === normalized)) return 'whitelist';
    const bl = tiktokSettings.blacklistedChannels || [];
    if (bl.some(e => TikTokPlatform.normalizeUsername(e) === normalized)) return 'blacklist';
    return 'none';
  }

  function isAllowOnlyMode() {
    return Boolean(settings?.enabled && tiktokSettings?.allowOnlyWhitelistedChannels);
  }

  function startObserver() {
    if (observer) return;
    const hints = TikTokPlatform.videoItemSelectors.slice(0, 3).join(', ');
    observer = new MutationObserver((mutations) => {
      let found = false;
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== Node.ELEMENT_NODE) continue;
          if (n.matches?.(hints) || n.querySelector?.(hints) || n.tagName === 'VIDEO' || n.querySelector?.('video')) {
            found = true; break;
          }
        }
        if (found) break;
      }
      if (found) scheduleScan(200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) { observer.disconnect(); observer = null; }
  }

  function scheduleScan(delay = 300) {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(() => { scanTimer = null; scanAll(); }, delay);
  }

  function setupNavigationListener() {
    const docObs = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        handleNavigation();
      }
    });
    docObs.observe(document, { subtree: true, childList: true });
    window.addEventListener('popstate', () => handleNavigation());
  }

  function handleNavigation() {
    TikTokBlocker.unblockAllPages();
    resetProcessedItems();
    scheduleScan(400);
  }

  function removeAllBlocking() {
    if (scanTimer) clearTimeout(scanTimer);
    TikTokBlocker.unblockAllPages();
    document.querySelectorAll('[data-safekid-tt-processed]').forEach(el => {
      TikTokBlocker.unblockVideoItem(el);
      delete el.dataset.safekidTtProcessed;
    });
  }

  function resetProcessedItems() {
    document.querySelectorAll('[data-safekid-tt-processed]').forEach(el => {
      TikTokBlocker.unblockVideoItem(el);
      delete el.dataset.safekidTtProcessed;
    });
  }

  async function updateStats(scanned, blocked) {
    try {
      const s = await StorageManager.getSettings();
      const tt = s.tiktok || {};
      const stats = tt.stats || { totalBlocked: 0, totalScanned: 0, lastActive: null };
      stats.totalScanned = (stats.totalScanned || 0) + scanned;
      stats.totalBlocked = (stats.totalBlocked || 0) + blocked;
      stats.lastActive = Date.now();
      await StorageManager.updateSettings({ tiktok: { ...tt, stats } });
      if (blocked > 0) chrome.runtime.sendMessage({ type: 'VIDEOS_BLOCKED', count: blocked });
    } catch (e) { /* ignore */ }
  }

  init();
})();
