/**
 * AI Video Blocker — Service Worker (Background)
 * Điều phối extension, xử lý messages, quản lý badge
 */

// Import storage utilities
importScripts('/utils/storage.js', '/utils/gemini.js', '/utils/openrouter.js');

const LOG_PREFIX = '[AIBlocker:SW]';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const geminiInFlight = new Map();
const openrouterInFlight = new Map();

// ==================== MESSAGE HANDLING ====================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender)
    .then(sendResponse)
    .catch((error) => {
      console.warn(`${LOG_PREFIX} Message failed:`, error?.message || error);
      sendResponse({ ok: false, error: error?.message || 'Unhandled background error' });
    });
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
      await migrateLegacyGeminiSecret();
      return await StorageManager.getSettings();

    case 'MIGRATE_GEMINI_SECRET':
      await migrateLegacyGeminiSecret();
      return { ok: true };

    case 'UPDATE_SETTINGS':
      return await updateSettingsSecure(msg.settings);

    case 'VERIFY_PASSWORD':
      const valid = await StorageManager.verifyPassword(msg.password);
      return { valid };

    case 'GET_FULL_STATS':
      return await getFullStats();

    case 'RESCAN_ALL':
      await rescanAllTabs();
      return { ok: true };

    case 'GEMINI_CLASSIFY_VIDEO':
      return await handleGeminiClassify(msg.payload || msg);

    case 'GET_GEMINI_CACHE_BATCH':
      return await getGeminiCacheBatch(msg.videoIds || []);

    case 'TEST_GEMINI_KEY':
      return await testGeminiKey(msg);

    case 'SAVE_GEMINI_KEY':
      return await saveGeminiKey(msg);

    case 'CLEAR_GEMINI_KEY':
      return await clearGeminiKey();

    case 'CLEAR_GEMINI_CACHE':
      return await clearGeminiCache();

    case 'OPENROUTER_CLASSIFY_VIDEO':
      return await handleOpenRouterClassify(msg.payload || msg);

    case 'TEST_OPENROUTER_KEY':
      return await testOpenRouterKey(msg);

    case 'SAVE_OPENROUTER_KEY':
      return await saveOpenRouterKey(msg);

    case 'CLEAR_OPENROUTER_KEY':
      return await clearOpenRouterKey();

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
  const geminiCache = await StorageManager.getGeminiCache();
  const geminiHasApiKey = await hasGeminiApiKey();
  
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
      gemini: blockedVideos.filter(v => v.method === 'gemini').length,
      openrouter: blockedVideos.filter(v => v.method === 'openrouter').length,
      combination: blockedVideos.filter(v => v.method === 'combination').length
    },
    geminiCacheSize: Object.keys(geminiCache).length,
    geminiEnabled: Boolean(settings.gemini?.enabled && geminiHasApiKey),
    openrouterEnabled: Boolean(settings.openrouter?.enabled && await hasOpenRouterApiKey()),
    activeProvider: settings.activeProvider || 'gemini',
    statsByContext: settings.stats.byContext || {},
    statsBySignal: settings.stats.bySignal || {},
    statsByRiskLevel: settings.stats.byRiskLevel || {},
    statsByRiskCategory: settings.stats.byRiskCategory || {},
    detectionProfile: settings.detectionProfile || 'recall-first',
    detectorVersion: StorageManager.DEFAULT_SETTINGS.detectorVersion
  };
}

// ==================== SECURE SETTINGS / SECRETS ====================

async function updateSettingsSecure(partial = {}) {
  const sanitized = { ...(partial || {}) };
  if (sanitized.gemini) {
    const gemini = { ...sanitized.gemini };
    if (Object.prototype.hasOwnProperty.call(gemini, 'apiKey')) {
      const apiKey = String(gemini.apiKey || '').trim();
      delete gemini.apiKey;
      if (apiKey) {
        await setGeminiApiKey(apiKey);
        gemini.hasApiKey = true;
      }
    }
    sanitized.gemini = gemini;
  }

  if (sanitized.openrouter) {
    const openrouter = { ...sanitized.openrouter };
    if (Object.prototype.hasOwnProperty.call(openrouter, 'apiKey')) {
      const apiKey = String(openrouter.apiKey || '').trim();
      delete openrouter.apiKey;
      if (apiKey) {
        await setOpenRouterApiKey(apiKey);
        openrouter.hasApiKey = true;
      }
    }
    sanitized.openrouter = openrouter;
  }

  const updated = await StorageManager.updateSettings(sanitized);
  
  const hasKey = await hasGeminiApiKey();
  const hasOrKey = await hasOpenRouterApiKey();
  
  let needsUpdate = false;
  const fixObj = {};
  
  if (updated.gemini?.hasApiKey !== hasKey) {
    fixObj.gemini = {
      ...updated.gemini,
      hasApiKey: hasKey,
      enabled: hasKey ? updated.gemini.enabled : false
    };
    needsUpdate = true;
  }
  
  if (updated.openrouter?.hasApiKey !== hasOrKey) {
    fixObj.openrouter = {
      ...updated.openrouter,
      hasApiKey: hasOrKey,
      enabled: hasOrKey ? updated.openrouter.enabled : false
    };
    needsUpdate = true;
  }

  if (needsUpdate) {
    return await StorageManager.updateSettings(fixObj);
  }
  return updated;
}

async function saveGeminiKey(msg = {}) {
  const apiKey = String(msg.apiKey || '').trim();
  if (!apiKey) return { ok: false, reason: 'missing_api_key' };

  const testResult = await testGeminiKey({
    apiKey,
    model: msg.model
  });
  if (!testResult.ok) return testResult;

  await setGeminiApiKey(apiKey);
  const settings = await StorageManager.getSettings();
  await StorageManager.updateSettings({
    gemini: {
      ...settings.gemini,
      hasApiKey: true,
      enabled: msg.enabled !== false,
      model: msg.model || settings.gemini?.model || GeminiClassifier.DEFAULT_MODEL,
      includeThumbnail: Boolean(msg.includeThumbnail),
      timeoutMs: msg.includeThumbnail ? 6000 : 3500
    }
  });

  return { ok: true, model: testResult.model || msg.model || GeminiClassifier.DEFAULT_MODEL };
}

async function clearGeminiKey() {
  await deleteGeminiApiKey();
  const settings = await StorageManager.getSettings();
  await StorageManager.updateSettings({
    gemini: {
      ...settings.gemini,
      enabled: false,
      hasApiKey: false
    }
  });
  return { ok: true };
}

async function migrateLegacyGeminiSecret() {
  const data = await chrome.storage.local.get(['settings', 'geminiSecrets']);
  const storedSettings = data.settings || {};
  const legacyGemini = storedSettings.gemini || {};
  const legacyApiKey = String(legacyGemini.apiKey || data.geminiSecrets?.apiKey || '').trim();
  const existingSecret = await readGeminiSecret();

  if (legacyApiKey && !existingSecret?.apiKey) {
    await writeGeminiSecret(legacyApiKey);
  }

  if (Object.prototype.hasOwnProperty.call(legacyGemini, 'apiKey') || data.geminiSecrets?.apiKey) {
    const cleanedGemini = { ...legacyGemini };
    delete cleanedGemini.apiKey;
    cleanedGemini.hasApiKey = Boolean(legacyApiKey || existingSecret?.apiKey);
    await chrome.storage.local.set({
      settings: {
        ...storedSettings,
        gemini: cleanedGemini
      },
      geminiSecrets: {}
    });
  }
}

async function migrateLegacyOpenRouterSecret() {
  const data = await chrome.storage.local.get(['settings', 'openrouterSecrets']);
  const storedSettings = data.settings || {};
  const legacyOpenRouter = storedSettings.openrouter || {};
  const legacyApiKey = String(legacyOpenRouter.apiKey || data.openrouterSecrets?.apiKey || '').trim();
  const existingSecret = await readOpenRouterSecret();

  if (legacyApiKey && !existingSecret?.apiKey) {
    await writeOpenRouterSecret(legacyApiKey);
  }

  if (Object.prototype.hasOwnProperty.call(legacyOpenRouter, 'apiKey') || data.openrouterSecrets?.apiKey) {
    const cleanedOpenRouter = { ...legacyOpenRouter };
    delete cleanedOpenRouter.apiKey;
    cleanedOpenRouter.hasApiKey = Boolean(legacyApiKey || existingSecret?.apiKey);
    await chrome.storage.local.set({
      settings: {
        ...storedSettings,
        openrouter: cleanedOpenRouter
      },
      openrouterSecrets: {}
    });
  }
}

async function hasGeminiApiKey() {
  const secret = await readGeminiSecret();
  if (secret?.apiKey) return true;

  const data = await chrome.storage.local.get('settings');
  return Boolean(data.settings?.gemini?.apiKey);
}

async function getGeminiApiKey() {
  await migrateLegacyGeminiSecret();
  const secret = await readGeminiSecret();
  return String(secret?.apiKey || '').trim();
}

async function setGeminiApiKey(apiKey) {
  await writeGeminiSecret(apiKey);
}

async function deleteGeminiApiKey() {
  await deleteGeminiSecret();
  await chrome.storage.local.set({ geminiSecrets: {} });
}

async function readGeminiSecret() {
  if (typeof indexedDB === 'undefined') {
    return getMemorySecretStore().geminiApiKey || null;
  }

  const db = await openSecretDb();
  return await idbRequest(db.transaction('secrets', 'readonly').objectStore('secrets').get('geminiApiKey'));
}

async function writeGeminiSecret(apiKey) {
  const record = {
    id: 'geminiApiKey',
    apiKey: String(apiKey || '').trim(),
    updatedAt: Date.now()
  };

  if (!record.apiKey) return;

  if (typeof indexedDB === 'undefined') {
    getMemorySecretStore().geminiApiKey = record;
    return;
  }

  const db = await openSecretDb();
  await idbRequest(db.transaction('secrets', 'readwrite').objectStore('secrets').put(record));
}

async function deleteGeminiSecret() {
  if (typeof indexedDB === 'undefined') {
    delete getMemorySecretStore().geminiApiKey;
    return;
  }

  const db = await openSecretDb();
  await idbRequest(db.transaction('secrets', 'readwrite').objectStore('secrets').delete('geminiApiKey'));
}

async function hasOpenRouterApiKey() {
  const secret = await readOpenRouterSecret();
  if (secret?.apiKey) return true;

  const data = await chrome.storage.local.get('settings');
  return Boolean(data.settings?.openrouter?.apiKey);
}

async function getOpenRouterApiKey() {
  await migrateLegacyOpenRouterSecret();
  const secret = await readOpenRouterSecret();
  return String(secret?.apiKey || '').trim();
}

async function setOpenRouterApiKey(apiKey) {
  await writeOpenRouterSecret(apiKey);
}

async function deleteOpenRouterApiKey() {
  await deleteOpenRouterSecret();
  await chrome.storage.local.set({ openrouterSecrets: {} });
}

async function readOpenRouterSecret() {
  if (typeof indexedDB === 'undefined') {
    return getMemorySecretStore().openRouterApiKey || null;
  }

  const db = await openSecretDb();
  return await idbRequest(db.transaction('secrets', 'readonly').objectStore('secrets').get('openRouterApiKey'));
}

async function writeOpenRouterSecret(apiKey) {
  const record = {
    id: 'openRouterApiKey',
    apiKey: String(apiKey || '').trim(),
    updatedAt: Date.now()
  };

  if (!record.apiKey) return;

  if (typeof indexedDB === 'undefined') {
    getMemorySecretStore().openRouterApiKey = record;
    return;
  }

  const db = await openSecretDb();
  await idbRequest(db.transaction('secrets', 'readwrite').objectStore('secrets').put(record));
}

async function deleteOpenRouterSecret() {
  if (typeof indexedDB === 'undefined') {
    delete getMemorySecretStore().openRouterApiKey;
    return;
  }

  const db = await openSecretDb();
  await idbRequest(db.transaction('secrets', 'readwrite').objectStore('secrets').delete('openRouterApiKey'));
}

function getMemorySecretStore() {
  if (!globalThis.__aivbMemorySecrets) globalThis.__aivbMemorySecrets = {};
  return globalThis.__aivbMemorySecrets;
}

function openSecretDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('aivb-secure-secrets', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('secrets')) {
        db.createObjectStore('secrets', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==================== GEMINI API ====================

async function handleGeminiClassify(payload = {}) {
  const videoId = String(payload.videoId || '').trim();
  if (!videoId) return { ok: false, skipped: true, reason: 'missing_video_id' };

  if (shouldBlockLocal(payload.localDetection)) {
    return { ok: true, skipped: true, reason: 'local_block' };
  }

  const settings = await StorageManager.getSettings();
  const apiKey = await getGeminiApiKey();
  const geminiSettings = GeminiClassifier.normalizeSettings(
    { ...settings.gemini, apiKey },
    payload.detectorVersion || settings.detectorVersion || StorageManager.DEFAULT_SETTINGS.detectorVersion
  );

  if (!geminiSettings.enabled) return { ok: false, skipped: true, reason: 'disabled' };
  if (!geminiSettings.apiKey) return { ok: false, skipped: true, reason: 'missing_api_key' };

  const cacheKey = GeminiClassifier.getCacheKey({
    videoId,
    model: geminiSettings.model,
    promptVersion: geminiSettings.promptVersion,
    includeThumbnail: geminiSettings.includeThumbnail,
    detectorVersion: geminiSettings.detectorVersion
  });

  const cached = await StorageManager.getGeminiCacheEntry(cacheKey);
  if (GeminiClassifier.isCacheEntryValid(cached)) {
    if (cached.status === 'error') {
      return { ok: false, cached: true, transient: true, reason: cached.error?.reason || 'transient_error' };
    }
    return { ok: true, cached: true, detection: cached.detection };
  }

  if (geminiInFlight.has(cacheKey)) {
    return await geminiInFlight.get(cacheKey);
  }

  const request = runGeminiClassification(payload, geminiSettings, cacheKey);
  geminiInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    geminiInFlight.delete(cacheKey);
  }
}

async function runGeminiClassification(payload, geminiSettings, cacheKey) {
  const input = normalizeGeminiInput(payload, geminiSettings);
  let thumbnail = null;

  if (geminiSettings.includeThumbnail) {
    thumbnail = await fetchThumbnailAsBase64(input.videoId, payload.thumbnailUrl);
  }

  const body = GeminiClassifier.buildRequestBody(input, geminiSettings, thumbnail);
  const timeoutMs = GeminiClassifier.getEffectiveTimeoutMs(geminiSettings);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(getGeminiEndpoint(geminiSettings.model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiSettings.apiKey
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const reason = getGeminiHttpReason(response.status);
      if (!isCacheableGeminiError(reason, response.status)) {
        return {
          ok: false,
          cached: false,
          transient: false,
          reason,
          status: response.status
        };
      }
      return await cacheGeminiError(cacheKey, {
        reason,
        status: response.status,
        model: geminiSettings.model,
        videoId: input.videoId
      });
    }

    const apiResponse = await response.json();
    const detection = GeminiClassifier.normalizeApiResponse(apiResponse, input);
    const status = GeminiClassifier.getCacheStatusForDetection(detection);
    await StorageManager.cacheGeminiResult(cacheKey, {
      status,
      videoId: input.videoId,
      model: geminiSettings.model,
      promptVersion: geminiSettings.promptVersion,
      includeThumbnail: geminiSettings.includeThumbnail,
      detectorVersion: geminiSettings.detectorVersion,
      detection
    });

    return { ok: true, cached: false, detection };
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'timeout' : 'invalid_response';
    return await cacheGeminiError(cacheKey, {
      reason,
      message: error?.message || '',
      model: geminiSettings.model,
      videoId: input.videoId
    });
  } finally {
    clearTimeout(timer);
  }
}

async function getGeminiCacheBatch(videoIds = []) {
  const ids = [...new Set((videoIds || []).filter(Boolean))];
  if (ids.length === 0) return { ok: true, detections: {} };

  const settings = await StorageManager.getSettings();
  const geminiHasApiKey = await hasGeminiApiKey();
  const geminiSettings = GeminiClassifier.normalizeSettings(
    settings.gemini,
    settings.detectorVersion || StorageManager.DEFAULT_SETTINGS.detectorVersion
  );

  if (!geminiSettings.enabled || !geminiHasApiKey) {
    return { ok: true, detections: {} };
  }

  const keyByVideoId = new Map(ids.map((videoId) => [
    videoId,
    GeminiClassifier.getCacheKey({
      videoId,
      model: geminiSettings.model,
      promptVersion: geminiSettings.promptVersion,
      includeThumbnail: geminiSettings.includeThumbnail,
      detectorVersion: geminiSettings.detectorVersion
    })
  ]));
  const entries = await StorageManager.getGeminiCacheEntries(Array.from(keyByVideoId.values()));
  const detections = {};

  for (const [videoId, key] of keyByVideoId.entries()) {
    const entry = entries[key];
    if (!GeminiClassifier.isCacheEntryValid(entry)) continue;
    if (entry.status === 'error') continue;
    if (entry.detection) detections[videoId] = entry.detection;
  }

  return { ok: true, detections };
}

async function testGeminiKey(msg = {}) {
  const settings = await StorageManager.getSettings();
  const apiKey = String(msg.apiKey || '').trim() || await getGeminiApiKey();
  const geminiSettings = GeminiClassifier.normalizeSettings({
    ...(settings.gemini || {}),
    apiKey,
    model: msg.model || settings.gemini?.model || GeminiClassifier.DEFAULT_MODEL
  }, settings.detectorVersion || StorageManager.DEFAULT_SETTINGS.detectorVersion);

  if (!geminiSettings.apiKey) {
    return { ok: false, reason: 'missing_api_key' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(getGeminiEndpoint(geminiSettings.model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiSettings.apiKey
      },
      body: JSON.stringify(GeminiClassifier.buildTestRequestBody()),
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: getGeminiHttpReason(response.status),
        status: response.status
      };
    }

    return { ok: true, model: geminiSettings.model };
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === 'AbortError' ? 'timeout' : 'request_failed',
      message: error?.message || ''
    };
  } finally {
    clearTimeout(timer);
  }
}

async function clearGeminiCache() {
  await StorageManager.clearGeminiCache();
  return { ok: true };
}

// ==================== OPENROUTER API ====================

async function saveOpenRouterKey(msg = {}) {
  const apiKey = String(msg.apiKey || '').trim();
  if (!apiKey) return { ok: false, reason: 'missing_api_key' };

  const testResult = await testOpenRouterKey({ apiKey, model: msg.model });
  if (!testResult.ok) return testResult;

  await setOpenRouterApiKey(apiKey);
  const settings = await StorageManager.getSettings();
  await StorageManager.updateSettings({
    openrouter: {
      ...settings.openrouter,
      hasApiKey: true,
      enabled: msg.enabled !== false,
      model: msg.model || settings.openrouter?.model || OpenRouterClassifier.DEFAULT_MODEL
    }
  });

  return { ok: true, model: testResult.model || msg.model || OpenRouterClassifier.DEFAULT_MODEL };
}

async function clearOpenRouterKey() {
  await deleteOpenRouterApiKey();
  const settings = await StorageManager.getSettings();
  await StorageManager.updateSettings({
    openrouter: {
      ...settings.openrouter,
      enabled: false,
      hasApiKey: false
    }
  });
  return { ok: true };
}

async function testOpenRouterKey(msg = {}) {
  const settings = await StorageManager.getSettings();
  const apiKey = String(msg.apiKey || '').trim() || await getOpenRouterApiKey();
  const orSettings = OpenRouterClassifier.normalizeSettings({
    ...(settings.openrouter || {}),
    apiKey,
    model: msg.model || settings.openrouter?.model || OpenRouterClassifier.DEFAULT_MODEL
  }, settings.detectorVersion || StorageManager.DEFAULT_SETTINGS.detectorVersion);

  if (!orSettings.apiKey) {
    return { ok: false, reason: 'missing_api_key' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${orSettings.apiKey}`,
        'HTTP-Referer': 'https://github.com/ai-video-blocker',
        'X-Title': 'AI Video Blocker'
      },
      body: JSON.stringify(OpenRouterClassifier.buildTestRequestBody(orSettings.model)),
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: getGeminiHttpReason(response.status), // We can reuse standard HTTP reasoning
        status: response.status
      };
    }

    return { ok: true, model: orSettings.model };
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === 'AbortError' ? 'timeout' : 'request_failed',
      message: error?.message || ''
    };
  } finally {
    clearTimeout(timer);
  }
}

async function handleOpenRouterClassify(payload = {}) {
  const videoId = String(payload.videoId || '').trim();
  if (!videoId) return { ok: false, skipped: true, reason: 'missing_video_id' };

  if (shouldBlockLocal(payload.localDetection)) {
    return { ok: true, skipped: true, reason: 'local_block' };
  }

  const settings = await StorageManager.getSettings();
  const apiKey = await getOpenRouterApiKey();
  const orSettings = OpenRouterClassifier.normalizeSettings(
    { ...settings.openrouter, apiKey },
    payload.detectorVersion || settings.detectorVersion || StorageManager.DEFAULT_SETTINGS.detectorVersion
  );

  if (!orSettings.enabled) return { ok: false, skipped: true, reason: 'disabled' };
  if (!orSettings.apiKey) return { ok: false, skipped: true, reason: 'missing_api_key' };

  const cacheKey = OpenRouterClassifier.getCacheKey({
    videoId,
    model: orSettings.model,
    promptVersion: orSettings.promptVersion,
    detectorVersion: orSettings.detectorVersion
  });

  const cached = await StorageManager.getGeminiCacheEntry(cacheKey);
  if (OpenRouterClassifier.isCacheEntryValid(cached)) {
    if (cached.status === 'error') {
      return { ok: false, cached: true, transient: true, reason: cached.error?.reason || 'transient_error' };
    }
    return { ok: true, cached: true, detection: cached.detection };
  }

  if (openrouterInFlight.has(cacheKey)) {
    return await openrouterInFlight.get(cacheKey);
  }

  const request = runOpenRouterClassificationWithFallback(payload, orSettings, cacheKey);
  openrouterInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    openrouterInFlight.delete(cacheKey);
  }
}

async function runOpenRouterClassificationWithFallback(payload, orSettings, cacheKey) {
  let modelsToTry = [orSettings.model];
  if (orSettings.autoFallback && Array.isArray(orSettings.fallbackModels)) {
    const fallbacks = orSettings.fallbackModels.filter(m => m && m !== orSettings.model);
    modelsToTry = modelsToTry.concat(fallbacks);
  }

  let lastErrorResult = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    const settingsForAttempt = { ...orSettings, model };
    
    const result = await runOpenRouterClassificationAttempt(payload, settingsForAttempt, cacheKey);
    
    if (result.ok) {
      return result;
    }
    
    // Only fallback for transient errors like 429, 502, 503, 504.
    const isFallbackableError = result.status === 429 || result.status >= 500 || result.reason === 'timeout' || result.reason === 'invalid_response';
    
    lastErrorResult = result;
    
    if (!isFallbackableError) {
      break; // Cannot fallback
    }
  }
  
  // If we get here, all attempts failed
  return await cacheGeminiError(cacheKey, {
    reason: lastErrorResult?.reason || 'transient_error',
    status: lastErrorResult?.status || 0,
    message: lastErrorResult?.message || 'All models failed',
    model: lastErrorResult?.model || orSettings.model,
    videoId: payload.videoId
  });
}

async function runOpenRouterClassificationAttempt(payload, orSettings, cacheKey) {
  const input = normalizeOpenRouterInput(payload, orSettings);
  const body = OpenRouterClassifier.buildRequestBody(input, orSettings);
  const timeoutMs = orSettings.timeoutMs || 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${orSettings.apiKey}`,
        'HTTP-Referer': 'https://github.com/ai-video-blocker',
        'X-Title': 'AI Video Blocker'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const reason = getGeminiHttpReason(response.status); // Reuse same HTTP reason logic
      return {
        ok: false,
        cached: false,
        transient: true, // Let outer loop decide
        reason,
        status: response.status,
        videoId: input.videoId,
        model: orSettings.model
      };
    }

    const apiResponse = await response.json();
    const detection = OpenRouterClassifier.normalizeApiResponse(apiResponse, input);
    const status = OpenRouterClassifier.getCacheStatusForDetection(detection);
    
    await StorageManager.cacheGeminiResult(cacheKey, {
      status,
      videoId: input.videoId,
      model: orSettings.model,
      promptVersion: orSettings.promptVersion,
      detectorVersion: orSettings.detectorVersion,
      detection
    });

    return { ok: true, cached: false, detection };
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'timeout' : 'invalid_response';
    return {
      ok: false,
      cached: false,
      transient: true,
      reason,
      status: 0,
      message: error?.message || '',
      videoId: input.videoId,
      model: orSettings.model
    };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeOpenRouterInput(payload = {}, orSettings = {}) {
  return {
    videoId: String(payload.videoId || ''),
    title: payload.title || payload.localDetection?.title || '',
    channel: payload.channel || payload.channelName || payload.localDetection?.channelName || '',
    description: payload.description || '',
    captionExcerpt: String(payload.captionExcerpt || payload.caption || '').slice(0, 4000),
    localDetection: payload.localDetection || {},
    detectorVersion: orSettings.detectorVersion,
    model: orSettings.model,
    promptVersion: orSettings.promptVersion
  };
}

function normalizeGeminiInput(payload = {}, geminiSettings = {}) {
  return {
    videoId: String(payload.videoId || ''),
    title: payload.title || payload.localDetection?.title || '',
    channel: payload.channel || payload.channelName || payload.localDetection?.channelName || '',
    description: payload.description || '',
    captionExcerpt: String(payload.captionExcerpt || payload.caption || '').slice(0, geminiSettings.maxCaptionChars),
    localDetection: payload.localDetection || {},
    detectorVersion: geminiSettings.detectorVersion,
    model: geminiSettings.model,
    promptVersion: geminiSettings.promptVersion,
    includeThumbnail: geminiSettings.includeThumbnail
  };
}

function getGeminiEndpoint(model) {
  const cleanModel = GeminiClassifier.normalizeModel(model);
  return `${GEMINI_API_BASE}/${encodeURIComponent(cleanModel)}:generateContent`;
}

function shouldBlockLocal(detection = {}) {
  if (!detection) return false;
  if (typeof detection.shouldBlock === 'boolean') return detection.shouldBlock;
  if (detection.riskLevel) return detection.riskLevel === 'block';
  return Boolean(detection.isAI);
}

function getGeminiHttpReason(status) {
  if (status === 404) return 'model_unavailable';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'service_unavailable';
  if (status === 401 || status === 403) return 'invalid_api_key';
  return 'api_error';
}

function isCacheableGeminiError(reason, status) {
  if (['model_unavailable', 'rate_limited', 'service_unavailable'].includes(reason)) return true;
  return Number(status || 0) >= 500;
}

async function cacheGeminiError(cacheKey, error = {}) {
  await StorageManager.cacheGeminiResult(cacheKey, {
    status: 'error',
    error: {
      reason: error.reason || 'transient_error',
      status: error.status,
      message: error.message || ''
    },
    videoId: error.videoId || '',
    model: error.model || ''
  });

  return {
    ok: false,
    cached: false,
    transient: true,
    reason: error.reason || 'transient_error',
    status: error.status
  };
}

async function fetchThumbnailAsBase64(videoId, preferredUrl = '') {
  const urls = [
    preferredUrl,
    videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '',
    videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : ''
  ].filter(Boolean);
  const uniqueUrls = [...new Set(urls)];

  for (const url of uniqueUrls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'omit',
        cache: 'force-cache'
      });
      if (!response.ok) continue;

      const contentType = response.headers?.get?.('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) continue;

      const buffer = await response.arrayBuffer();
      if (!buffer || buffer.byteLength > 2 * 1024 * 1024) continue;

      return {
        data: arrayBufferToBase64(buffer),
        mimeType: contentType.split(';')[0] || 'image/jpeg'
      };
    } catch (e) {
      // Thumbnail là optional; lỗi ảnh không được làm chậm/chặn local flow.
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  if (typeof btoa === 'function') return btoa(binary);
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  return binary;
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
  await migrateLegacyGeminiSecret();
  await migrateLegacyOpenRouterSecret();

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
  await migrateLegacyGeminiSecret();
  await migrateLegacyOpenRouterSecret();
  await updateBadge(0);
});

console.log(`${LOG_PREFIX} Service worker loaded`);
