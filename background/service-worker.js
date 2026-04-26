/**
 * AI Video Blocker — Service Worker (Background)
 * Điều phối extension, xử lý messages, quản lý badge
 */

// Import storage utilities
importScripts('/utils/storage.js');

const LOG_PREFIX = '[AIBlocker:SW]';

// ==================== MESSAGE HANDLING ====================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse);
  return true; // async
});

async function handleMessage(msg, sender) {
  switch (msg.type) {
    case 'VIDEOS_BLOCKED':
      await updateBadge(msg.count);
      return { ok: true };

    case 'WHITELIST_CHANNEL':
      return await whitelistChannel(msg.channel, msg.url);

    case 'GET_SETTINGS':
      return await StorageManager.getSettings();

    case 'UPDATE_SETTINGS':
      return await StorageManager.updateSettings(msg.settings);

    case 'VERIFY_PASSWORD':
      const valid = await StorageManager.verifyPassword(msg.password);
      return { valid };

    case 'GET_FULL_STATS':
      return await getFullStats();

    case 'RESCAN_ALL':
      await rescanAllTabs();
      return { ok: true };

    default:
      return { error: 'Unknown message type' };
  }
}

// ==================== BADGE ====================

async function updateBadge(count) {
  try {
    if (count > 0) {
      await chrome.action.setBadgeText({ text: String(count) });
      await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (e) {
    console.warn(`${LOG_PREFIX} Badge update failed:`, e);
  }
}

// ==================== WHITELIST ====================

async function whitelistChannel(channel, url) {
  const settings = await StorageManager.getSettings();
  if (!settings.whitelistedChannels.includes(channel)) {
    settings.whitelistedChannels.push(channel);
    await StorageManager.updateSettings({ whitelistedChannels: settings.whitelistedChannels });
    console.log(`${LOG_PREFIX} Whitelisted: ${channel}`);

    // Rescan tất cả tabs YouTube
    await rescanAllTabs();
  }
  return { ok: true, channel };
}

// ==================== STATS ====================

async function getFullStats() {
  const settings = await StorageManager.getSettings();
  const cache = await StorageManager.getVideoCache();
  
  const cachedVideos = Object.values(cache);
  const blockedVideos = cachedVideos.filter(v => v.shouldBlock || v.riskLevel === 'block' || v.isAI);

  return {
    totalBlocked: settings.stats.totalBlocked,
    totalScanned: settings.stats.totalScanned,
    lastActive: settings.stats.lastActive,
    cacheSize: cachedVideos.length,
    cachedAI: blockedVideos.length,
    whitelistedCount: settings.whitelistedChannels.length,
    blacklistedCount: settings.blacklistedChannels.length,
    methodBreakdown: {
      label: blockedVideos.filter(v => v.method === 'label').length,
      keyword: blockedVideos.filter(v => v.method === 'keyword').length,
      pattern: blockedVideos.filter(v => v.method === 'pattern').length,
      channel: blockedVideos.filter(v => v.method === 'channel').length,
      disclosure: blockedVideos.filter(v => v.method === 'disclosure').length,
      childRisk: blockedVideos.filter(v => v.method === 'childRisk').length,
      combination: blockedVideos.filter(v => v.method === 'combination').length
    },
    statsByContext: settings.stats.byContext || {},
    statsBySignal: settings.stats.bySignal || {},
    statsByRiskLevel: settings.stats.byRiskLevel || {},
    statsByRiskCategory: settings.stats.byRiskCategory || {},
    detectionProfile: settings.detectionProfile || 'recall-first',
    detectorVersion: StorageManager.DEFAULT_SETTINGS.detectorVersion
  };
}

// ==================== TAB MANAGEMENT ====================

async function rescanAllTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ['*://www.youtube.com/*', '*://youtube.com/*'] });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'RESCAN' });
      } catch (e) {
        // Tab might not have content script loaded
      }
    }
  } catch (e) {
    console.warn(`${LOG_PREFIX} Rescan failed:`, e);
  }
}

// ==================== INSTALLATION ====================

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`${LOG_PREFIX} Installed:`, details.reason);

  if (details.reason === 'install') {
    // Khởi tạo settings mặc định
    await StorageManager.updateSettings(StorageManager.DEFAULT_SETTINGS);
    
    // Mở welcome page (optional)
    // chrome.tabs.create({ url: 'welcome/welcome.html' });
  }

  // Clear badge
  await updateBadge(0);
});

// Startup
chrome.runtime.onStartup.addListener(async () => {
  console.log(`${LOG_PREFIX} Started`);
  await updateBadge(0);
});

console.log(`${LOG_PREFIX} Service worker loaded`);
