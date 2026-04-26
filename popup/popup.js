/**
 * SafeKid — Popup Script
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

  const checkboxAiEnabled = $('#checkbox-ai-enabled');
  const aiProviderHeader = $('#ai-provider-header');
  const aiProviderDetails = $('#ai-provider-details');
  const aiProviderChevron = $('#ai-provider-chevron');
  const activeProviderBadge = $('#active-provider-badge');

  const geminiForm = $('#gemini-form');
  const openrouterForm = $('#openrouter-form');

  const geminiApiKey = $('#gemini-api-key');
  const btnTestGemini = $('#btn-test-gemini');
  const geminiModel = $('#gemini-model');
  const btnClearGeminiKey = $('#btn-clear-gemini-key');
  const geminiStatusText = $('#gemini-status-text');
  const geminiStatus = $('#gemini-status');

  const openrouterApiKey = $('#openrouter-api-key');
  const btnTestOpenrouter = $('#btn-test-openrouter');
  const openrouterModel = $('#openrouter-model');
  const btnClearOpenrouterKey = $('#btn-clear-openrouter-key');
  const openrouterStatusText = $('#openrouter-status-text');
  const openrouterStatus = $('#openrouter-status');

  const checkboxAiThumbnail = $('#checkbox-ai-thumbnail');
  const aiCacheCount = $('#ai-cache-count');
  const btnClearAiCache = $('#btn-clear-ai-cache');

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

    // AI Provider Setup
    const gemini = s.gemini || {};
    const openrouter = s.openrouter || {};
    const activeProvider = s.activeProvider || 'openrouter';

    // Set Provider Radio
    const providerRadio = document.querySelector(`input[name="activeProvider"][value="${activeProvider}"]`);
    if (providerRadio) providerRadio.checked = true;

    // Toggle Forms Visibility
    geminiForm.style.display = activeProvider === 'gemini' ? 'flex' : 'none';
    openrouterForm.style.display = activeProvider === 'openrouter' ? 'flex' : 'none';

    const activeSettings = activeProvider === 'gemini' ? gemini : openrouter;
    checkboxAiEnabled.checked = Boolean(activeSettings.enabled && activeSettings.hasApiKey);
    activeProviderBadge.textContent = checkboxAiEnabled.checked ? (activeProvider === 'gemini' ? 'Gemini' : 'OpenRouter') : 'Tắt';
    activeProviderBadge.style.color = checkboxAiEnabled.checked ? 'white' : 'var(--text-muted)';
    activeProviderBadge.style.background = checkboxAiEnabled.checked ? 'var(--accent-indigo)' : 'rgba(99, 102, 241, 0.1)';

    // OpenRouter
    openrouterApiKey.value = '';
    openrouterApiKey.placeholder = openrouter.hasApiKey ? 'API key đã lưu an toàn' : 'Nhập OpenRouter API key...';
    openrouterModel.value = openrouter.model || 'google/gemini-2.0-flash-lite-preview-02-05:free';
    openrouterStatusText.textContent = openrouter.hasApiKey ? 'Đã lưu Key' : 'Chưa cấu hình';
    openrouterStatusText.style.color = openrouter.hasApiKey ? 'var(--accent-green)' : 'var(--text-secondary)';

    // Gemini
    geminiApiKey.value = '';
    geminiApiKey.placeholder = gemini.hasApiKey ? 'API key đã lưu an toàn' : 'Nhập Gemini API key...';
    geminiModel.value = gemini.model || 'gemini-3.1-flash-lite-preview';
    geminiStatusText.textContent = gemini.hasApiKey ? 'Đã lưu Key' : 'Chưa cấu hình';
    geminiStatusText.style.color = gemini.hasApiKey ? 'var(--accent-green)' : 'var(--text-secondary)';

    // Common
    checkboxAiThumbnail.checked = activeProvider === 'gemini' ? Boolean(gemini.includeThumbnail) : Boolean(openrouter.includeThumbnail);

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
        aiCacheCount.textContent = formatNumber(stats.geminiCacheSize || 0);
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

  // AI Provider Collapsible
  aiProviderHeader.addEventListener('click', (e) => {
    if (e.target.tagName.toLowerCase() === 'input' || e.target.classList.contains('toggle-slider')) return;
    const isHidden = aiProviderDetails.style.display === 'none';
    aiProviderDetails.style.display = isHidden ? 'block' : 'none';
    aiProviderChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  });

  // Provider Selection
  $$('input[name="activeProvider"]').forEach(radio => {
    radio.addEventListener('change', async () => {
      const activeProvider = radio.value;
      geminiForm.style.display = activeProvider === 'gemini' ? 'flex' : 'none';
      openrouterForm.style.display = activeProvider === 'openrouter' ? 'flex' : 'none';
      await updateSetting({ activeProvider });
      
      settings = await getSettings();
      await loadUI(settings);
    });
  });

  // AI Enabled Toggle
  checkboxAiEnabled.addEventListener('change', async () => {
    settings = await getSettings();
    const activeProvider = settings.activeProvider || 'openrouter';
    const providerSettings = settings[activeProvider] || {};
    const apiKeyInput = activeProvider === 'gemini' ? geminiApiKey : openrouterApiKey;
    const setStatus = activeProvider === 'gemini' ? setGeminiStatus : setOpenrouterStatus;

    if (checkboxAiEnabled.checked && !providerSettings.hasApiKey && !apiKeyInput.value.trim()) {
      checkboxAiEnabled.checked = false;
      setStatus('Nhập API key rồi bấm Kiểm tra trước khi bật.', 'error');
      return;
    }

    if (checkboxAiEnabled.checked && apiKeyInput.value.trim()) {
      if (activeProvider === 'gemini') await testAndSaveGeminiKey(true);
      else await testAndSaveOpenrouterKey(true);
      return;
    }

    await saveProviderPartial(activeProvider, { enabled: checkboxAiEnabled.checked });
    setStatus(checkboxAiEnabled.checked ? `${activeProvider} API đã bật.` : `${activeProvider} API đã tắt.`, 'success');
    await loadUI(await getSettings());
  });

  // OpenRouter Events
  btnTestOpenrouter.addEventListener('click', async () => {
    await testAndSaveOpenrouterKey(true);
  });

  openrouterModel.addEventListener('change', async () => {
    await saveProviderPartial('openrouter', { model: openrouterModel.value });
    setOpenrouterStatus('Đã lưu model OpenRouter.', 'success');
  });

  btnClearOpenrouterKey.addEventListener('click', async () => {
    btnClearOpenrouterKey.disabled = true;
    await sendMessage({ type: 'CLEAR_OPENROUTER_KEY' });
    openrouterApiKey.value = '';
    
    settings = await getSettings();
    if (settings.activeProvider === 'openrouter') checkboxAiEnabled.checked = false;
    
    await loadUI(settings);
    setOpenrouterStatus('Đã xóa API key OpenRouter khỏi kho secret.', 'success');
    btnClearOpenrouterKey.disabled = false;
  });

  // Gemini Events
  btnTestGemini.addEventListener('click', async () => {
    await testAndSaveGeminiKey(true);
  });

  geminiModel.addEventListener('change', async () => {
    await saveProviderPartial('gemini', { model: geminiModel.value });
    setGeminiStatus('Đã lưu model Gemini.', 'success');
  });

  btnClearGeminiKey.addEventListener('click', async () => {
    btnClearGeminiKey.disabled = true;
    await sendMessage({ type: 'CLEAR_GEMINI_KEY' });
    geminiApiKey.value = '';
    
    settings = await getSettings();
    if (settings.activeProvider === 'gemini') checkboxAiEnabled.checked = false;
    
    await loadUI(settings);
    setGeminiStatus('Đã xóa API key Gemini khỏi kho secret.', 'success');
    btnClearGeminiKey.disabled = false;
  });

  // Common Events
  checkboxAiThumbnail.addEventListener('change', async () => {
    settings = await getSettings();
    const activeProvider = settings.activeProvider || 'openrouter';
    await saveProviderPartial(activeProvider, {
      includeThumbnail: checkboxAiThumbnail.checked,
      timeoutMs: checkboxAiThumbnail.checked ? (activeProvider === 'gemini' ? 6000 : 8000) : (activeProvider === 'gemini' ? 3500 : 5000)
    });
    const setStatus = activeProvider === 'gemini' ? setGeminiStatus : setOpenrouterStatus;
    setStatus(checkboxAiThumbnail.checked ? 'Đã bật phân tích thumbnail.' : 'Đã tắt phân tích thumbnail.', 'success');
  });

  btnClearAiCache.addEventListener('click', async () => {
    btnClearAiCache.disabled = true;
    await sendMessage({ type: 'CLEAR_GEMINI_CACHE' }); // the backend uses this to clear the common AI cache
    await loadStats();
    
    settings = await getSettings();
    const activeProvider = settings.activeProvider || 'openrouter';
    const setStatus = activeProvider === 'gemini' ? setGeminiStatus : setOpenrouterStatus;
    setStatus('Đã xóa cache phân tích AI.', 'success');
    
    btnClearAiCache.disabled = false;
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

  async function saveProviderPartial(provider, partial) {
    settings = await getSettings();
    const current = settings[provider] || {};
    const next = {
      ...current,
      ...partial
    };
    return await updateSetting({ [provider]: next });
  }

  async function testAndSaveGeminiKey(enableAfterSuccess = false) {
    const apiKey = geminiApiKey.value.trim();
    settings = await getSettings();
    const hasSavedKey = Boolean(settings.gemini?.hasApiKey);

    if (!apiKey && !hasSavedKey) {
      setGeminiStatus('Chưa có API key để kiểm tra.', 'error');
      if (settings.activeProvider === 'gemini') checkboxAiEnabled.checked = false;
      return;
    }

    btnTestGemini.disabled = true;
    btnTestGemini.textContent = 'Đang kiểm...';
    setGeminiStatus('Đang kiểm tra API key...', 'neutral');

    const result = apiKey
      ? await sendMessage({
        type: 'SAVE_GEMINI_KEY',
        apiKey,
        model: geminiModel.value,
        enabled: enableAfterSuccess || (settings.activeProvider === 'gemini' ? checkboxAiEnabled.checked : settings.gemini.enabled),
        includeThumbnail: checkboxAiThumbnail.checked
      })
      : await sendMessage({
        type: 'TEST_GEMINI_KEY',
        model: geminiModel.value
      });

    btnTestGemini.disabled = false;
    btnTestGemini.textContent = 'Kiểm tra';

    if (!result?.ok) {
      if (settings.activeProvider === 'gemini') checkboxAiEnabled.checked = false;
      setGeminiStatus(getApiErrorText(result, 'Gemini'), 'error');
      return;
    }

    if (!apiKey) {
      await saveProviderPartial('gemini', {
        enabled: enableAfterSuccess || (settings.activeProvider === 'gemini' ? checkboxAiEnabled.checked : settings.gemini.enabled),
        model: geminiModel.value,
        includeThumbnail: checkboxAiThumbnail.checked,
        timeoutMs: checkboxAiThumbnail.checked ? 6000 : 3500
      });
    } else {
      await sendMessage({ type: 'RESCAN_ALL' });
    }
    
    settings = await getSettings();
    await loadUI(settings);
    setGeminiStatus('API key hợp lệ.', 'success');
  }

  async function testAndSaveOpenrouterKey(enableAfterSuccess = false) {
    const apiKey = openrouterApiKey.value.trim();
    settings = await getSettings();
    const hasSavedKey = Boolean(settings.openrouter?.hasApiKey);

    if (!apiKey && !hasSavedKey) {
      setOpenrouterStatus('Chưa có API key để kiểm tra.', 'error');
      if (settings.activeProvider === 'openrouter') checkboxAiEnabled.checked = false;
      return;
    }

    btnTestOpenrouter.disabled = true;
    btnTestOpenrouter.textContent = 'Đang kiểm...';
    setOpenrouterStatus('Đang kiểm tra API key...', 'neutral');

    const result = apiKey
      ? await sendMessage({
        type: 'SAVE_OPENROUTER_KEY',
        apiKey,
        model: openrouterModel.value,
        enabled: enableAfterSuccess || (settings.activeProvider === 'openrouter' ? checkboxAiEnabled.checked : settings.openrouter.enabled)
      })
      : await sendMessage({
        type: 'TEST_OPENROUTER_KEY',
        model: openrouterModel.value
      });

    btnTestOpenrouter.disabled = false;
    btnTestOpenrouter.textContent = 'Kiểm tra';

    if (!result?.ok) {
      if (settings.activeProvider === 'openrouter') checkboxAiEnabled.checked = false;
      setOpenrouterStatus(getApiErrorText(result, 'OpenRouter'), 'error');
      return;
    }

    if (!apiKey) {
      await saveProviderPartial('openrouter', {
        enabled: enableAfterSuccess || (settings.activeProvider === 'openrouter' ? checkboxAiEnabled.checked : settings.openrouter.enabled),
        model: openrouterModel.value
      });
    } else {
      await sendMessage({ type: 'RESCAN_ALL' });
    }
    
    settings = await getSettings();
    await loadUI(settings);
    setOpenrouterStatus('API key hợp lệ.', 'success');
  }

  function setGeminiStatus(text, tone = 'neutral') {
    geminiStatus.textContent = text || '';
    const colors = { success: '#22c55e', error: '#ef4444', neutral: '#94a3b8' };
    geminiStatus.style.color = colors[tone] || colors.neutral;
  }
  
  function setOpenrouterStatus(text, tone = 'neutral') {
    openrouterStatus.textContent = text || '';
    const colors = { success: '#22c55e', error: '#ef4444', neutral: '#94a3b8' };
    openrouterStatus.style.color = colors[tone] || colors.neutral;
  }

  function getApiErrorText(result = {}, provider = 'API') {
    const labels = {
      missing_api_key: 'Thiếu API key.',
      invalid_api_key: 'API key không hợp lệ hoặc chưa có quyền.',
      model_unavailable: 'Model chưa khả dụng cho key này.',
      rate_limited: 'Key đang bị giới hạn quota, thử lại sau.',
      service_unavailable: `${provider} tạm thời không phản hồi.`,
      timeout: 'Kiểm tra key quá thời gian chờ.',
      request_failed: `Không gọi được ${provider}.`
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
      openrouter: 'OpenRouter API',
      combination: 'Kết hợp'
    };
    return labels[key] || key;
  }
});
