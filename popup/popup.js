/**
 * AI Video Blocker — Popup Script
 * Quản lý settings UI, parental lock, channel lists
 */

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Elements
  const lockScreen = $('#lock-screen');
  const mainScreen = $('#main-screen');
  const passwordInput = $('#password-input');
  const btnUnlock = $('#btn-unlock');
  const lockError = $('#lock-error');

  const checkboxEnabled = $('#checkbox-enabled');
  const statBlocked = $('#stat-blocked');
  const statScanned = $('#stat-scanned');
  const statAccuracy = $('#stat-accuracy');
  const breakStrong = $('#break-strong');
  const breakMedium = $('#break-medium');
  const breakWeak = $('#break-weak');
  const breakMethod = $('#break-method');

  const newPassword = $('#new-password');
  const btnSetPassword = $('#btn-set-password');
  const passwordStatus = $('#password-status');

  const whitelistInput = $('#whitelist-input');
  const btnAddWhitelist = $('#btn-add-whitelist');
  const whitelistContainer = $('#whitelist-container');
  const whitelistCount = $('#whitelist-count');

  const blacklistInput = $('#blacklist-input');
  const btnAddBlacklist = $('#btn-add-blacklist');
  const blacklistContainer = $('#blacklist-container');
  const blacklistCount = $('#blacklist-count');

  const btnRescan = $('#btn-rescan');

  const checkboxGeminiEnabled = $('#checkbox-gemini-enabled');
  const geminiApiKey = $('#gemini-api-key');
  const btnTestGemini = $('#btn-test-gemini');
  const geminiModel = $('#gemini-model');
  const checkboxGeminiThumbnail = $('#checkbox-gemini-thumbnail');
  const geminiCacheCount = $('#gemini-cache-count');
  const btnClearGeminiCache = $('#btn-clear-gemini-cache');
  const geminiStatus = $('#gemini-status');

  // ==================== INITIALIZATION ====================

  let settings = await getSettings();

  // Check parental lock
  if (settings.parentalPassword && settings.isLocked) {
    lockScreen.style.display = 'flex';
    mainScreen.style.display = 'none';
    passwordInput.focus();
  } else {
    lockScreen.style.display = 'none';
    mainScreen.style.display = 'block';
    await loadUI(settings);
  }

  // ==================== LOCK SCREEN ====================

  btnUnlock.addEventListener('click', async () => {
    const result = await sendMessage({ type: 'VERIFY_PASSWORD', password: passwordInput.value });
    if (result.valid) {
      lockScreen.style.display = 'none';
      mainScreen.style.display = 'block';
      settings = await getSettings();
      await loadUI(settings);
    } else {
      lockError.style.display = 'block';
      passwordInput.value = '';
      passwordInput.focus();
      setTimeout(() => { lockError.style.display = 'none'; }, 2000);
    }
  });

  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnUnlock.click();
  });

  // ==================== LOAD UI ====================

  async function loadUI(s) {
    // Toggle
    checkboxEnabled.checked = s.enabled;

    // Sensitivity
    const sensRadio = document.querySelector(`input[name="sensitivity"][value="${s.sensitivity}"]`);
    if (sensRadio) sensRadio.checked = true;

    // Detection profile
    const profileRadio = document.querySelector(`input[name="detectionProfile"][value="${s.detectionProfile || 'recall-first'}"]`);
    if (profileRadio) profileRadio.checked = true;

    // Gemini API
    const gemini = s.gemini || {};
    checkboxGeminiEnabled.checked = Boolean(gemini.enabled && gemini.apiKey);
    geminiApiKey.value = '';
    geminiApiKey.placeholder = gemini.apiKey ? 'API key đã lưu' : 'Nhập Gemini API key...';
    geminiModel.value = gemini.model || 'gemini-3.1-flash-lite-preview';
    checkboxGeminiThumbnail.checked = Boolean(gemini.includeThumbnail);

    // Channel lists
    renderChannelList(whitelistContainer, s.whitelistedChannels, 'whitelist');
    whitelistCount.textContent = s.whitelistedChannels.length;

    renderChannelList(blacklistContainer, s.blacklistedChannels, 'blacklist');
    blacklistCount.textContent = s.blacklistedChannels.length;

    // Stats
    await loadStats();
  }

  async function loadStats() {
    try {
      const stats = await sendMessage({ type: 'GET_FULL_STATS' });
      if (stats) {
        statBlocked.textContent = formatNumber(stats.totalBlocked);
        statScanned.textContent = formatNumber(stats.totalScanned);
        
        if (stats.totalScanned > 0) {
          const rate = Math.round((stats.totalBlocked / stats.totalScanned) * 100);
          statAccuracy.textContent = `${rate}%`;
        }

        breakStrong.textContent = formatNumber(stats.statsBySignal?.strong || 0);
        breakMedium.textContent = formatNumber(stats.statsBySignal?.medium || 0);
        breakWeak.textContent = formatNumber(stats.statsBySignal?.weak || 0);
        breakMethod.textContent = topMethod(stats.methodBreakdown || {});
        geminiCacheCount.textContent = formatNumber(stats.geminiCacheSize || 0);
      }
    } catch (e) {
      // Extension might not be active on current tab
    }
  }

  // ==================== EVENT HANDLERS ====================

  // Toggle enabled
  checkboxEnabled.addEventListener('change', async () => {
    await updateSetting({ enabled: checkboxEnabled.checked });
  });

  // Sensitivity
  $$('input[name="sensitivity"]').forEach(radio => {
    radio.addEventListener('change', async () => {
      await updateSetting({ sensitivity: radio.value });
    });
  });

  // Detection profile
  $$('input[name="detectionProfile"]').forEach(radio => {
    radio.addEventListener('change', async () => {
      await updateSetting({ detectionProfile: radio.value });
    });
  });

  checkboxGeminiEnabled.addEventListener('change', async () => {
    settings = await getSettings();
    const gemini = { ...(settings.gemini || {}) };

    if (checkboxGeminiEnabled.checked && !gemini.apiKey && !geminiApiKey.value.trim()) {
      checkboxGeminiEnabled.checked = false;
      setGeminiStatus('Nhập API key rồi bấm Kiểm tra trước khi bật.', 'error');
      return;
    }

    if (checkboxGeminiEnabled.checked && geminiApiKey.value.trim()) {
      await testAndSaveGeminiKey(true);
      return;
    }

    await saveGeminiPartial({ enabled: checkboxGeminiEnabled.checked });
    setGeminiStatus(checkboxGeminiEnabled.checked ? 'Gemini API đã bật.' : 'Gemini API đã tắt.', 'success');
  });

  btnTestGemini.addEventListener('click', async () => {
    await testAndSaveGeminiKey(true);
  });

  geminiModel.addEventListener('change', async () => {
    await saveGeminiPartial({ model: geminiModel.value });
    setGeminiStatus('Đã lưu model Gemini.', 'success');
  });

  checkboxGeminiThumbnail.addEventListener('change', async () => {
    await saveGeminiPartial({
      includeThumbnail: checkboxGeminiThumbnail.checked,
      timeoutMs: checkboxGeminiThumbnail.checked ? 6000 : 3500
    });
    setGeminiStatus(checkboxGeminiThumbnail.checked ? 'Đã bật phân tích thumbnail.' : 'Đã tắt phân tích thumbnail.', 'success');
  });

  btnClearGeminiCache.addEventListener('click', async () => {
    btnClearGeminiCache.disabled = true;
    await sendMessage({ type: 'CLEAR_GEMINI_CACHE' });
    await loadStats();
    setGeminiStatus('Đã xóa cache Gemini.', 'success');
    btnClearGeminiCache.disabled = false;
  });

  // Set password
  btnSetPassword.addEventListener('click', async () => {
    const pwd = newPassword.value.trim();
    if (pwd.length < 4) {
      passwordStatus.textContent = 'Mật khẩu ít nhất 4 ký tự!';
      passwordStatus.style.color = '#ef4444';
      return;
    }
    await updateSetting({ parentalPassword: pwd, isLocked: true });
    newPassword.value = '';
    passwordStatus.textContent = '✅ Đã lưu mật khẩu!';
    passwordStatus.style.color = '#22c55e';
    setTimeout(() => { passwordStatus.textContent = ''; }, 2000);
  });

  // Whitelist
  btnAddWhitelist.addEventListener('click', () => addChannel('whitelist'));
  whitelistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addChannel('whitelist');
  });

  // Blacklist
  btnAddBlacklist.addEventListener('click', () => addChannel('blacklist'));
  blacklistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addChannel('blacklist');
  });

  // Rescan
  btnRescan.addEventListener('click', async () => {
    btnRescan.textContent = '⏳ Đang quét...';
    btnRescan.disabled = true;
    await sendMessage({ type: 'RESCAN_ALL' });
    setTimeout(async () => {
      await loadStats();
      btnRescan.textContent = '🔄 Quét lại';
      btnRescan.disabled = false;
    }, 1500);
  });

  // ==================== CHANNEL MANAGEMENT ====================

  async function addChannel(listType) {
    const input = listType === 'whitelist' ? whitelistInput : blacklistInput;
    const name = input.value.trim();
    if (!name) return;

    settings = await getSettings();
    const key = listType === 'whitelist' ? 'whitelistedChannels' : 'blacklistedChannels';
    
    if (!settings[key].includes(name)) {
      settings[key].push(name);
      await updateSetting({ [key]: settings[key] });
    }

    input.value = '';
    
    const container = listType === 'whitelist' ? whitelistContainer : blacklistContainer;
    const countEl = listType === 'whitelist' ? whitelistCount : blacklistCount;
    renderChannelList(container, settings[key], listType);
    countEl.textContent = settings[key].length;
  }

  async function removeChannel(name, listType) {
    settings = await getSettings();
    const key = listType === 'whitelist' ? 'whitelistedChannels' : 'blacklistedChannels';
    settings[key] = settings[key].filter(c => c !== name);
    await updateSetting({ [key]: settings[key] });

    const container = listType === 'whitelist' ? whitelistContainer : blacklistContainer;
    const countEl = listType === 'whitelist' ? whitelistCount : blacklistCount;
    renderChannelList(container, settings[key], listType);
    countEl.textContent = settings[key].length;
  }

  function renderChannelList(container, channels, listType) {
    container.innerHTML = '';
    channels.forEach(name => {
      const tag = document.createElement('div');
      tag.className = 'channel-tag';
      tag.innerHTML = `
        <span>${escapeHtml(name)}</span>
        <span class="channel-tag-remove">×</span>
      `;
      tag.querySelector('.channel-tag-remove').addEventListener('click', () => {
        removeChannel(name, listType);
      });
      container.appendChild(tag);
    });
  }

  // ==================== HELPERS ====================

  async function getSettings() {
    return await sendMessage({ type: 'GET_SETTINGS' });
  }

  async function updateSetting(partial) {
    const result = await sendMessage({ type: 'UPDATE_SETTINGS', settings: partial });
    settings = result || settings;
    // Trigger rescan after settings change
    await sendMessage({ type: 'RESCAN_ALL' });
    return settings;
  }

  async function saveGeminiPartial(partial) {
    settings = await getSettings();
    const currentGemini = settings.gemini || {};
    const nextGemini = {
      ...currentGemini,
      ...partial
    };
    return await updateSetting({ gemini: nextGemini });
  }

  async function testAndSaveGeminiKey(enableAfterSuccess = false) {
    const apiKey = geminiApiKey.value.trim();
    settings = await getSettings();
    const currentKey = settings.gemini?.apiKey || '';

    if (!apiKey && !currentKey) {
      setGeminiStatus('Chưa có API key để kiểm tra.', 'error');
      checkboxGeminiEnabled.checked = false;
      return;
    }

    btnTestGemini.disabled = true;
    btnTestGemini.textContent = 'Đang kiểm...';
    setGeminiStatus('Đang kiểm tra API key...', 'neutral');

    const result = await sendMessage({
      type: 'TEST_GEMINI_KEY',
      apiKey: apiKey || currentKey,
      model: geminiModel.value
    });

    btnTestGemini.disabled = false;
    btnTestGemini.textContent = 'Kiểm tra';

    if (!result?.ok) {
      checkboxGeminiEnabled.checked = false;
      setGeminiStatus(getGeminiErrorText(result), 'error');
      return;
    }

    await saveGeminiPartial({
      enabled: enableAfterSuccess || checkboxGeminiEnabled.checked,
      apiKey: apiKey || currentKey,
      model: geminiModel.value,
      includeThumbnail: checkboxGeminiThumbnail.checked,
      timeoutMs: checkboxGeminiThumbnail.checked ? 6000 : 3500
    });
    geminiApiKey.value = '';
    geminiApiKey.placeholder = 'API key đã lưu';
    checkboxGeminiEnabled.checked = true;
    setGeminiStatus('API key hợp lệ. Gemini API đã bật.', 'success');
  }

  function setGeminiStatus(text, tone = 'neutral') {
    geminiStatus.textContent = text || '';
    const colors = {
      success: '#22c55e',
      error: '#ef4444',
      neutral: '#94a3b8'
    };
    geminiStatus.style.color = colors[tone] || colors.neutral;
  }

  function getGeminiErrorText(result = {}) {
    const labels = {
      missing_api_key: 'Thiếu API key.',
      invalid_api_key: 'API key không hợp lệ hoặc chưa có quyền.',
      model_unavailable: 'Model preview chưa khả dụng cho key này.',
      rate_limited: 'Key đang bị giới hạn quota, thử lại sau.',
      service_unavailable: 'Gemini tạm thời không phản hồi.',
      timeout: 'Kiểm tra key quá thời gian chờ.',
      request_failed: 'Không gọi được Gemini API.'
    };
    return labels[result.reason] || `Không kiểm tra được API key${result.status ? ` (${result.status})` : ''}.`;
  }

  function sendMessage(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (response) => {
        resolve(response || {});
      });
    });
  }

  function formatNumber(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function topMethod(methodBreakdown) {
    let key = '—';
    let max = 0;
    for (const [method, count] of Object.entries(methodBreakdown)) {
      if (Number(count) > max) {
        key = method;
        max = Number(count);
      }
    }
    const labels = {
      label: 'YouTube label',
      keyword: 'Từ khóa AI',
      pattern: 'Pattern',
      channel: 'Channel',
      disclosure: 'Disclosure',
      childRisk: 'Rủi ro trẻ em',
      gemini: 'Gemini API',
      combination: 'Kết hợp'
    };
    return labels[key] || key;
  }
});
